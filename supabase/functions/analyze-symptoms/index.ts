import { parseSymptomAnalysis } from '../_shared/schemas.ts'
import { applySafetyRules } from '../_shared/safety.ts'
import { createTraceId, logTrace } from '../_shared/observability.ts'
import {
  classifySymptomRoute,
  escalateTier,
  formatRoutingNote,
  getQualityEscalationChain,
  getMaxTokens,
  filterModelChain,
  getModelChain,
  isLowConfidenceAnalysis,
  type RouteTier,
} from '../_shared/model-router.ts'
import { anyLlmProviderConfigured, llmConfigError } from '../_shared/llm/env.ts'
import { formatModelUsed, invokeWithToolChain, isClaudeTarget } from '../_shared/llm/invoke.ts'
import { ANALYSIS_TOOL } from '../_shared/llm/symptom-tools.ts'
import {
  buildRagMissedPromptBlock,
  formatSymptomRagNote,
  retrieveSymptomMedicalContext,
} from '../_shared/rag-retrieve.ts'
import { ANALYSIS_SYSTEM, buildConversationHints } from '../_shared/symptom-prompts.ts'
import { parseSymptomQueryContext } from '../_shared/symptom-query.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const traceId = createTraceId()

  try {
    if (!anyLlmProviderConfigured()) {
      return new Response(JSON.stringify({ error: llmConfigError() }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const symptoms = typeof body.symptoms === 'string' ? body.symptoms.trim() : ''
    const language = body.language === 'ur' ? 'ur' : 'en'
    const userAge = body.userAge ?? body.user_age
    const userGender = body.userGender ?? body.user_gender

    if (!symptoms) {
      return new Response(
        JSON.stringify({ error: 'Symptoms text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userPrompt =
      language === 'ur'
        ? `مریض کی علامات: ${symptoms}. عمر: ${userAge ?? 'نامعلوم'}. جنس: ${userGender ?? 'نامعلوم'}.`
        : `Patient symptoms: ${symptoms}. Age: ${userAge ?? 'unknown'}. Gender: ${userGender ?? 'unknown'}.`

    let route = classifySymptomRoute({
      userText: symptoms,
      phase: 'analysis',
      turnCount: 0,
      userMessageCount: 1,
    })

    if (filterModelChain(route.modelChain).length === 0) {
      return new Response(JSON.stringify({ error: llmConfigError() }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let safeResult: Record<string, unknown> | null = null
    let lastError: Error | null = null
    let usedModel: string | null = null
    let totalLatency = 0
    let inputTokens: number | null = null
    let outputTokens: number | null = null
    let lastAttempts: string[] = []
    const tiersAttempted: RouteTier[] = [route.tier]

    let ragNote = 'rag:skipped'
    let ragContextBlock = ''
    let ragResult = {
      context: '',
      sources: [] as { title: string; source: string; section: string | null; similarity: number }[],
      chunkCount: 0,
      status: 'none' as const,
      method: 'none' as const,
    }
    if (route.useRag) {
      ragResult = await retrieveSymptomMedicalContext([symptoms], [], {
        matchCount: 4,
        timeoutMs: 4500,
      })
      ragNote = formatSymptomRagNote(ragResult)
      ragContextBlock = ragResult.context
    }

    for (let tierAttempt = 0; tierAttempt < 2 && !safeResult; tierAttempt++) {
      const hints = buildConversationHints({
        userText: symptoms,
        language,
        phase: 'analysis',
      })
      const contextNote =
        language === 'ur'
          ? `\n[مریض: عمر ${userAge ?? 'نامعلوم'}, جنس ${userGender ?? 'نامعلوم'}]`
          : `\n[Patient: age ${userAge ?? 'unknown'}, gender ${userGender ?? 'unknown'}]`
      let systemPrompt = ANALYSIS_SYSTEM + contextNote + hints.blockText
      if (ragContextBlock) {
        systemPrompt = `${systemPrompt}\n\n## Retrieved medical references (PRIMARY — base analysis on these)\n${ragContextBlock}`
      } else if (route.useRag) {
        systemPrompt = `${systemPrompt}${buildRagMissedPromptBlock(ragResult)}`
      }

      try {
        const call = await invokeWithToolChain({
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          tool: ANALYSIS_TOOL,
          toolName: 'submit_symptom_analysis',
          maxTokens: route.maxTokens,
          chain: filterModelChain(route.modelChain),
        })
        usedModel = formatModelUsed(call)
        totalLatency += call.latencyMs
        inputTokens = call.inputTokens
        outputTokens = call.outputTokens
        lastAttempts = call.attempts

        const parsed = parseSymptomAnalysis(call.input)
        if (!parsed.success) {
          await logTrace({
            traceId,
            functionName: 'analyze-symptoms',
            model: usedModel,
            latencyMs: totalLatency,
            status: 'validation_failed',
            errorMessage: parsed.error,
            routingNote: `${formatRoutingNote(route, { modelUsed: usedModel, attempts: lastAttempts })};${ragNote}`,
          })
          lastError = new Error(parsed.error)
          if (tierAttempt === 0) {
            route = {
              ...route,
              reasons: [...route.reasons, 'validation_failed_retry'],
              modelChain: getQualityEscalationChain('analysis'),
              maxTokens: getMaxTokens(route.tier, 'analysis'),
            }
          }
          continue
        }

        let data = parsed.data
        if (
          isLowConfidenceAnalysis(call.input) &&
          !isClaudeTarget({ provider: call.provider, model: call.model })
        ) {
          try {
            const retryCall = await invokeWithToolChain({
              system: systemPrompt,
              messages: [{ role: 'user', content: userPrompt }],
              tool: ANALYSIS_TOOL,
              toolName: 'submit_symptom_analysis',
              maxTokens: getMaxTokens(route.tier, 'analysis'),
              chain: getQualityEscalationChain('analysis'),
            })
            const reparsed = parseSymptomAnalysis(retryCall.input)
            if (reparsed.success) {
              data = reparsed.data
              usedModel = formatModelUsed(retryCall)
              totalLatency += retryCall.latencyMs
              inputTokens = retryCall.inputTokens
              outputTokens = retryCall.outputTokens
              lastAttempts = [...lastAttempts, ...retryCall.attempts]
            }
          } catch {
            /* keep first result */
          }
        }

        const safe = applySafetyRules(data, symptoms)
        safeResult = { ...safe, trace_id: traceId }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.error('analyze-symptoms LLM error:', lastError.message)
      }

      const nextTier = escalateTier(route.tier)
      if (!safeResult && nextTier && !tiersAttempted.includes(nextTier)) {
        tiersAttempted.push(nextTier)
        route = {
          ...route,
          tier: nextTier,
          reasons: [...route.reasons, `escalated_from_${route.tier}`],
          modelChain: getModelChain(nextTier, 'analysis'),
          maxTokens: getMaxTokens(nextTier, 'analysis'),
          useRag: true,
        }
      }
    }

    if (!safeResult) {
      await logTrace({
        traceId,
        functionName: 'analyze-symptoms',
        model: usedModel,
        latencyMs: totalLatency,
        status: 'error',
        errorMessage: lastError?.message ?? 'All AI models failed',
        routingNote: `${formatRoutingNote(route, { attempts: lastAttempts })};${ragNote}`,
      })
      throw lastError ?? new Error('All AI models failed')
    }

    await logTrace({
      traceId,
      functionName: 'analyze-symptoms',
      model: usedModel,
      inputTokens,
      outputTokens,
      latencyMs: totalLatency,
      status: 'ok',
      routingNote: `${formatRoutingNote(route, { modelUsed: usedModel ?? undefined, attempts: lastAttempts })};${ragNote}`,
    })

    return new Response(JSON.stringify(safeResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('analyze-symptoms error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Analysis failed',
        trace_id: traceId,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
