import { parseSymptomAnalysis } from '../_shared/schemas.ts'
import { matchesEmergencySymptoms } from '../_shared/emergency-detect.ts'
import {
  applySafetyRules,
  buildGuidedFallbackAnalysis,
  buildGuidedFollowUpFallback,
} from '../_shared/safety.ts'
import { createTraceId, logTrace } from '../_shared/observability.ts'
import type { RagSourceRef } from '../_shared/rag.ts'
import {
  buildRagMissedPromptBlock,
  formatSymptomRagNote,
  retrieveSymptomMedicalContext,
  type SymptomRagResult,
} from '../_shared/rag-retrieve.ts'
import {
  detectConversationLanguage,
  detectUrduVariant,
} from '../_shared/roman-urdu.ts'
import { isAllergyTriageSufficient } from '../_shared/symptom-intent.ts'
import {
  enrichAffirmativeReplies,
  needsYellowFeverSymptomFollowUp,
  parseSymptomQueryContext,
  userRequestsImmediateGuidance,
  userWantsNearbyDoctorForSeizures,
} from '../_shared/symptom-query.ts'
import {
  classifySymptomRoute,
  escalateTier,
  formatRoutingNote,
  getQualityEscalationChain,
  getMaxTokens,
  filterModelChain,
  getModelChain,
  isLowConfidenceAnalysis,
  type ClientTriageHint,
  type RouteTier,
} from '../_shared/model-router.ts'
import { anyLlmProviderConfigured, llmConfigError } from '../_shared/llm/env.ts'
import {
  formatModelUsed,
  invokeWithToolChain,
  isClaudeTarget,
} from '../_shared/llm/invoke.ts'
import { FOLLOW_UP_TOOL, ANALYSIS_TOOL } from '../_shared/llm/symptom-tools.ts'
import {
  buildAnalysisSystem,
  buildChatSystem,
  buildConversationHints,
} from '../_shared/symptom-prompts.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  quickSeverity?: 'mild' | 'moderate' | 'severe' | 'emergency' | null
}

function lastAssistantQuickSeverity(
  messages: ChatMsg[]
): 'mild' | 'moderate' | 'severe' | 'emergency' | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'assistant' && m.quickSeverity) {
      return m.quickSeverity
    }
  }
  return null
}

function parseClientTriage(body: Record<string, unknown>): ClientTriageHint | null {
  const raw = body.clientTriage ?? body.client_triage
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>
  const severity = t.severity
  const valid = ['mild', 'moderate', 'severe', 'emergency'] as const
  return {
    severity: valid.includes(severity as typeof valid[number])
      ? (severity as ClientTriageHint['severity'])
      : null,
    isEmergency: Boolean(t.isEmergency ?? t.is_emergency),
    matchedKeywords: Array.isArray(t.matchedKeywords)
      ? t.matchedKeywords.filter((k): k is string => typeof k === 'string')
      : Array.isArray(t.matched_keywords)
        ? t.matched_keywords.filter((k): k is string => typeof k === 'string')
        : undefined,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const traceId = createTraceId()

  try {
    if (!anyLlmProviderConfigured()) {
      return new Response(JSON.stringify({ error: llmConfigError() }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const messages: ChatMsg[] = Array.isArray(body.messages)
      ? body.messages.map((m: Record<string, unknown>) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: typeof m.content === 'string' ? m.content : '',
          quickSeverity: m.quickSeverity ?? m.quick_severity ?? undefined,
        }))
      : []
    const clientLanguage = body.language === 'ur' ? 'ur' : 'en'
    const userAge = body.userAge ?? body.user_age
    const userGender = body.userGender ?? body.user_gender
    const turnCount = Number(body.turnCount ?? 0)
    const forceFinalize = Boolean(body.forceFinalize)
    const sessionId = body.sessionId ?? body.session_id ?? null
    const userId = body.userId ?? body.user_id ?? null
    const clientTriage = parseClientTriage(body)
    const lastQuickSeverity =
      body.lastQuickSeverity ??
      body.last_quick_severity ??
      lastAssistantQuickSeverity(messages)

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const userLines = messages.filter((m) => m.role === 'user').map((m) => m.content)
    const assistantLines = messages.filter((m) => m.role === 'assistant').map((m) => m.content)
    const analysisUserLines = enrichAffirmativeReplies(userLines, assistantLines)
    const language = detectConversationLanguage(userLines, clientLanguage)
    const urduVariant = detectUrduVariant(userLines)

    const contextNote =
      language === 'ur'
        ? `\n[مریض: عمر ${userAge ?? 'نامعلوم'}, جنس ${userGender ?? 'نامعلوم'}]`
        : `\n[Patient: age ${userAge ?? 'unknown'}, gender ${userGender ?? 'unknown'}]`
    const userText = userLines.join(' ')
    const analysisUserText = analysisUserLines.join(' ')
    const userMessageCount = messages.filter((m) => m.role === 'user').length

    const queryCtx = parseSymptomQueryContext(userLines, assistantLines)
    const deferForYellowFeverSymptoms = needsYellowFeverSymptomFollowUp(queryCtx)

    const emergencyCase =
      Boolean(clientTriage?.isEmergency) || matchesEmergencySymptoms(userText)

    const allergyReadyToFinalize = isAllergyTriageSufficient(userLines)

    const shouldFinalize =
      forceFinalize ||
      emergencyCase ||
      userMessageCount >= 5 ||
      userRequestsImmediateGuidance(userLines) ||
      userWantsNearbyDoctorForSeizures(userLines) ||
      (allergyReadyToFinalize && userMessageCount >= 2 && !deferForYellowFeverSymptoms) ||
      ((turnCount >= 2 || userMessageCount >= 3) && !deferForYellowFeverSymptoms)

    const finalizeCtx = shouldFinalize
      ? parseSymptomQueryContext(analysisUserLines, assistantLines)
      : queryCtx

    const phase = shouldFinalize ? 'analysis' : 'follow_up'
    let route = classifySymptomRoute({
      userText,
      phase,
      turnCount,
      userMessageCount,
      forceFinalize,
      clientTriage,
      lastQuickSeverity: lastQuickSeverity ?? null,
    })

    const activeChain = filterModelChain(route.modelChain)
    if (activeChain.length === 0) {
      return new Response(JSON.stringify({ error: llmConfigError() }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let result: Record<string, unknown> | null = null
    let lastError: Error | null = null
    let usedModel: string | null = null
    let totalLatency = 0
    let inputTokens: number | null = null
    let outputTokens: number | null = null
    let lastAttempts: string[] = []

    const tiersAttempted: RouteTier[] = [route.tier]

    let ragNote = 'rag:skipped'
    let ragSources: RagSourceRef[] = []
    let ragContextBlock = ''
    let ragResult: SymptomRagResult = {
      context: '',
      sources: [],
      chunkCount: 0,
      status: 'none',
      method: 'none',
    }

    // Stage 3–4: RAG runs ONLY on final analysis (never during follow-up / triage).
    if (shouldFinalize && route.useRag && !emergencyCase) {
      try {
        ragResult = await retrieveSymptomMedicalContext(analysisUserLines, assistantLines, {
          matchCount: 4,
          timeoutMs: 4500,
        })
        ragNote = formatSymptomRagNote(ragResult)
        ragSources = ragResult.sources
        ragContextBlock = ragResult.context
      } catch (ragErr) {
        console.warn('RAG failed:', ragErr instanceof Error ? ragErr.message : ragErr)
        ragNote = 'rag:error'
      }
    }

    const ragMeta = {
      sources: ragSources,
      status: ragResult.status,
      method: ragResult.method,
    }

    const analysisMaxAttempts =
      emergencyCase || route.tier === 'premium' ? activeChain.length : 2

    // ── Stage 2 (follow-up) or Stage 5–6 (LLM final analysis with optional RAG context) ──
    outer: for (let tierAttempt = 0; tierAttempt < 2 && !result; tierAttempt++) {
      const tool = shouldFinalize ? ANALYSIS_TOOL : FOLLOW_UP_TOOL
      const toolName = tool.name
      const hints = buildConversationHints(
        {
          userText: shouldFinalize ? analysisUserText : userText,
          language,
          phase: shouldFinalize ? 'analysis' : 'follow_up',
          assistantLines,
        },
        shouldFinalize ? finalizeCtx : queryCtx,
        urduVariant
      )
      let system = shouldFinalize
        ? buildAnalysisSystem(contextNote, hints)
        : buildChatSystem(contextNote, hints)

      // RAG context is attached to the LLM only at final analysis — never in triage questions
      if (shouldFinalize && ragContextBlock) {
        system = `${system}\n\n## Retrieved medical references (PRIMARY — base analysis on these)\n${ragContextBlock}`
      } else if (shouldFinalize && route.useRag) {
        system = `${system}${buildRagMissedPromptBlock(ragResult)}`
      }

      try {
        const call = await invokeWithToolChain({
          system,
          messages: apiMessages,
          tool,
          toolName,
          maxTokens: route.maxTokens,
          chain: filterModelChain(route.modelChain),
          maxAttempts: shouldFinalize ? analysisMaxAttempts : undefined,
        })
        usedModel = formatModelUsed(call)
        totalLatency += call.latencyMs
        inputTokens = call.inputTokens
        outputTokens = call.outputTokens
        lastAttempts = call.attempts

        if (shouldFinalize) {
          const parsed = parseSymptomAnalysis(call.input)
          if (!parsed.success) {
            await logTrace({
              traceId,
              functionName: 'symptom-chat',
              model: usedModel,
              latencyMs: totalLatency,
              status: 'validation_failed',
              errorMessage: parsed.error,
              routingNote: `${formatRoutingNote(route, { modelUsed: usedModel, attempts: lastAttempts })};${ragNote}`,
              userId,
              sessionId,
            })
            lastError = new Error(parsed.error)
            if (tierAttempt === 0) {
              route = {
                ...route,
                reasons: [...route.reasons, 'validation_failed_retry'],
                modelChain: getQualityEscalationChain(phase),
                maxTokens: getMaxTokens(route.tier, phase),
              }
              continue
            }
            continue
          }

          // ── Stage 7: Post-processing (Urdu cleanup + safety rules) ──
          const safe = applySafetyRules(parsed.data, analysisUserText)

          if (
            route.tier === 'premium' &&
            isLowConfidenceAnalysis(call.input) &&
            !isClaudeTarget({ provider: call.provider, model: call.model })
          ) {
            try {
              const retryCall = await invokeWithToolChain({
                system,
                messages: apiMessages,
                tool: ANALYSIS_TOOL,
                toolName: 'submit_symptom_analysis',
                maxTokens: getMaxTokens(route.tier, 'analysis'),
                chain: getQualityEscalationChain('analysis'),
              })
              const reparsed = parseSymptomAnalysis(retryCall.input)
              if (reparsed.success) {
                usedModel = formatModelUsed(retryCall)
                totalLatency += retryCall.latencyMs
                inputTokens = retryCall.inputTokens
                outputTokens = retryCall.outputTokens
                lastAttempts = [...lastAttempts, ...retryCall.attempts]
                result = {
                  type: 'analysis',
                  analysis: applySafetyRules(reparsed.data, userText),
                  trace_id: traceId,
                  _routing: {
                    tier: route.tier,
                    reasons: [...route.reasons, 'low_confidence_retry'],
                    model: usedModel,
                  },
                  _rag: ragMeta,
                }
                break outer
              }
            } catch {
              /* keep first analysis */
            }
          }

          result = {
            type: 'analysis',
            analysis: safe,
            trace_id: traceId,
            _routing: { tier: route.tier, reasons: route.reasons, model: usedModel },
            _rag: ragMeta,
          }
        } else {
          result = {
            type: 'follow_up',
            message: call.input.message,
            quick_severity: call.input.quick_severity,
            trace_id: traceId,
            _routing: { tier: route.tier, reasons: route.reasons, model: usedModel },
          }
        }
        break outer
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
      }

      const nextTier = escalateTier(route.tier)
      if (shouldFinalize && nextTier && !tiersAttempted.includes(nextTier)) {
        tiersAttempted.push(nextTier)
        route = {
          ...route,
          tier: nextTier,
          reasons: [...route.reasons, `escalated_from_${route.tier}`],
          modelChain: getModelChain(nextTier, phase),
          maxTokens: getMaxTokens(nextTier, phase),
          useRag: true,
        }
        continue
      }
      break
    }

    // Last resort when all LLM providers fail — rule-based triage or analysis
    if (!result && !shouldFinalize) {
      const followUp = buildGuidedFollowUpFallback(userLines, assistantLines, language)
      if (followUp) {
        result = {
          type: 'follow_up',
          message: followUp.message,
          quick_severity: followUp.quick_severity,
          trace_id: traceId,
          _routing: {
            tier: route.tier,
            reasons: [...route.reasons, 'llm_failed_guided_follow_up'],
            model: usedModel ?? 'guided_fallback',
          },
        }
        usedModel = usedModel ?? 'guided_fallback'
      }
    }

    if (!result) {
      const fallbackText = shouldFinalize ? analysisUserText : userText
      const fallback = buildGuidedFallbackAnalysis(fallbackText)
      if (fallback) {
        result = {
          type: 'analysis',
          analysis: applySafetyRules(fallback, fallbackText),
          trace_id: traceId,
          _routing: {
            tier: route.tier,
            reasons: [...route.reasons, 'llm_failed_guided_fallback'],
            model: usedModel ?? 'fallback',
          },
          _rag: ragMeta,
        }
        usedModel = usedModel ?? 'guided_fallback'
      }
    }

    if (!result) {
      await logTrace({
        traceId,
        functionName: 'symptom-chat',
        model: usedModel,
        latencyMs: totalLatency,
        status: 'error',
        errorMessage: lastError?.message ?? 'AI request failed',
        routingNote: `${formatRoutingNote(route, { modelUsed: usedModel ?? undefined, attempts: lastAttempts })};${ragNote}`,
        userId,
        sessionId,
      })
      throw lastError ?? new Error('AI request failed')
    }

    await logTrace({
      traceId,
      functionName: 'symptom-chat',
      model: usedModel,
      inputTokens,
      outputTokens,
      latencyMs: totalLatency,
      status: 'ok',
      routingNote: `${formatRoutingNote(route, { modelUsed: usedModel ?? undefined, attempts: lastAttempts })};${ragNote}`,
      userId,
      sessionId,
    })

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('symptom-chat error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Chat failed',
        trace_id: traceId,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
