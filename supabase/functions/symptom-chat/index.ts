import Anthropic from 'npm:@anthropic-ai/sdk'
import { callWithTool } from '../_shared/claude.ts'
import { parseSymptomAnalysis } from '../_shared/schemas.ts'
import { applySafetyRules } from '../_shared/safety.ts'
import { createTraceId, logTrace } from '../_shared/observability.ts'
import { retrieveMedicalContextWithTimeout } from '../_shared/rag.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

const FOLLOW_UP_TOOL: Anthropic.Tool = {
  name: 'ask_follow_up',
  description: 'Ask ONE concise follow-up question to clarify symptoms',
  input_schema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Single follow-up question, conversational tone' },
      quick_severity: {
        type: 'string',
        enum: ['mild', 'moderate', 'severe', 'emergency'],
        description: 'Preliminary severity estimate based on info so far',
      },
    },
    required: ['message', 'quick_severity'],
  },
}

const ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'submit_symptom_analysis',
  description: 'Final structured symptom analysis',
  input_schema: {
    type: 'object',
    properties: {
      primary_condition: { type: 'string' },
      condition_confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      brief_summary: { type: 'string' },
      possible_conditions: { type: 'array', items: { type: 'string' }, maxItems: 5 },
      recommended_specialty: { type: 'string' },
      recommended_specialty_slug: {
        type: 'string',
        enum: [
          'general', 'cardiology', 'dermatology', 'orthopedics', 'gynecology',
          'pediatrics', 'neurology', 'ent', 'ophthalmology', 'psychiatry',
          'urology', 'gastroenterology', 'endocrinology', 'pulmonology',
        ],
      },
      severity_level: { type: 'string', enum: ['mild', 'moderate', 'severe', 'emergency'] },
      explanation: { type: 'string' },
      first_aid_tips: { type: 'array', items: { type: 'string' }, maxItems: 5 },
      red_flags: { type: 'array', items: { type: 'string' }, maxItems: 5 },
      disclaimer: { type: 'string' },
      urdu_summary: { type: 'string' },
    },
    required: [
      'primary_condition', 'condition_confidence', 'brief_summary',
      'possible_conditions', 'recommended_specialty', 'recommended_specialty_slug',
      'severity_level', 'explanation', 'first_aid_tips', 'red_flags', 'disclaimer', 'urdu_summary',
    ],
  },
}

const FOLLOW_UP_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'] as const
const ANALYSIS_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-sonnet-4-5-20250929'] as const

const CHAT_SYSTEM = `You are HealthPilot AI — a conversational symptom assistant for Pakistan.

Your job in CHAT mode: ask ONE helpful follow-up question at a time to clarify:
- duration, severity, associated symptoms
- relevant history (diabetes, BP, pregnancy if applicable)
- red flags (breathing difficulty, chest pain, bleeding)

Rules:
- Be warm, concise, empathetic — like a doctor's first questions
- ONE question only per turn (not a list)
- Use Pakistani context when relevant (dengue season, typhoid, etc.)
- If symptoms suggest emergency, set quick_severity to emergency and ask if they need ER now
- Respond in the user's language (English or Urdu)
- Never diagnose — gather info for later analysis`

const ANALYSIS_SYSTEM = `You are HealthPilot AI — finalize symptom analysis for Pakistani users.

Provide structured analysis via submit_symptom_analysis tool.
- primary_condition: most likely concern in plain language
- Keep explanation concise (under 90 words)
- Keep urdu_summary to 2–3 sentences
- Pakistan context: dengue, typhoid, malaria when relevant
- Emergency numbers in red_flags when needed: Rescue 1122, Edhi 115
- urdu_summary: complete Urdu paragraph
- NOT a final diagnosis — say so in disclaimer`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const traceId = createTraceId()

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const messages: ChatMsg[] = Array.isArray(body.messages) ? body.messages : []
    const language = body.language === 'ur' ? 'ur' : 'en'
    const userAge = body.userAge ?? body.user_age
    const userGender = body.userGender ?? body.user_gender
    const turnCount = Number(body.turnCount ?? 0)
    const forceFinalize = Boolean(body.forceFinalize)
    const sessionId = body.sessionId ?? body.session_id ?? null
    const userId = body.userId ?? body.user_id ?? null

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const anthropic = new Anthropic({ apiKey })
    const contextNote =
      language === 'ur'
        ? `\n[مریض: عمر ${userAge ?? 'نامعلوم'}, جنس ${userGender ?? 'نامعلوم'}]`
        : `\n[Patient: age ${userAge ?? 'unknown'}, gender ${userGender ?? 'unknown'}]`

    const apiMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const userText = messages.filter((m) => m.role === 'user').map((m) => m.content).join(' ')

    const shouldFinalize =
      forceFinalize ||
      turnCount >= 2 ||
      messages.filter((m) => m.role === 'user').length >= 3

    let result: Record<string, unknown> | null = null
    let lastError: Error | null = null
    let usedModel: string | null = null
    let totalLatency = 0
    let inputTokens: number | null = null
    let outputTokens: number | null = null

    const modelChain = shouldFinalize ? ANALYSIS_MODELS : FOLLOW_UP_MODELS

    for (const model of modelChain) {
      try {
        if (shouldFinalize) {
          const ragContext = await retrieveMedicalContextWithTimeout(userText, null, 3, 2500)
          const analysisSystem = ragContext
            ? `${ANALYSIS_SYSTEM + contextNote}\n\n## Retrieved medical references\n${ragContext}`
            : ANALYSIS_SYSTEM + contextNote

          const call = await callWithTool(
            anthropic,
            model,
            analysisSystem,
            apiMessages,
            ANALYSIS_TOOL,
            'submit_symptom_analysis',
            1024
          )
          usedModel = call.model
          totalLatency += call.latencyMs
          inputTokens = call.inputTokens
          outputTokens = call.outputTokens

          const parsed = parseSymptomAnalysis(call.input)
          if (!parsed.success) {
            await logTrace({
              traceId,
              functionName: 'symptom-chat',
              model: usedModel,
              latencyMs: totalLatency,
              status: 'validation_failed',
              errorMessage: parsed.error,
              userId,
              sessionId,
            })
            lastError = new Error(parsed.error)
            continue
          }

          const safe = applySafetyRules(parsed.data, userText)
          result = { type: 'analysis', analysis: safe, trace_id: traceId }
        } else {
          const call = await callWithTool(
            anthropic,
            model,
            CHAT_SYSTEM + contextNote,
            apiMessages,
            FOLLOW_UP_TOOL,
            'ask_follow_up',
            320
          )
          usedModel = call.model
          totalLatency = call.latencyMs
          inputTokens = call.inputTokens
          outputTokens = call.outputTokens
          result = {
            type: 'follow_up',
            message: call.input.message,
            quick_severity: call.input.quick_severity,
            trace_id: traceId,
          }
        }
        break
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
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
