import Anthropic from 'npm:@anthropic-ai/sdk'
import { MODELS } from '../_shared/models.ts'
import { callWithTool } from '../_shared/claude.ts'
import { parseSymptomAnalysis } from '../_shared/schemas.ts'
import { applySafetyRules } from '../_shared/safety.ts'
import { createTraceId, logTrace } from '../_shared/observability.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'submit_symptom_analysis',
  description: 'Return structured symptom analysis for HealthPilot AI',
  input_schema: {
    type: 'object',
    properties: {
      primary_condition: { type: 'string' },
      condition_confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      brief_summary: { type: 'string' },
      possible_conditions: { type: 'array', items: { type: 'string' } },
      recommended_specialty: { type: 'string' },
      recommended_specialty_slug: {
        type: 'string',
        enum: [
          'general', 'cardiology', 'dermatology', 'orthopedics', 'gynecology',
          'pediatrics', 'neurology', 'ent', 'ophthalmology', 'psychiatry',
          'urology', 'gastroenterology', 'endocrinology', 'pulmonology',
        ],
      },
      severity_level: {
        type: 'string',
        enum: ['mild', 'moderate', 'severe', 'emergency'],
      },
      explanation: { type: 'string' },
      first_aid_tips: { type: 'array', items: { type: 'string' } },
      red_flags: { type: 'array', items: { type: 'string' } },
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

const SYSTEM_PROMPT = `You are HealthPilot AI, a medical symptom analysis assistant for Pakistani users.

Analyze symptoms and return structured results via the submit_symptom_analysis tool.

Rules:
- NOT a final medical diagnosis — always clarify this in the disclaimer
- Be empathetic and culturally sensitive for Pakistan
- For emergencies (heart attack, stroke, severe breathing difficulty), set severity_level to emergency
- Mention emergency numbers in red_flags when relevant: Rescue 1122, Edhi 115
- urdu_summary must be a complete Urdu paragraph (proper Unicode)
- Keep explanation concise but helpful for Pakistani context (dengue, typhoid, etc. when relevant)
- Use the correct recommended_specialty_slug from the allowed enum values`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const traceId = createTraceId()

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured on Supabase' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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

    const anthropic = new Anthropic({ apiKey })

    const userPrompt =
      language === 'ur'
        ? `مریض کی علامات: ${symptoms}. عمر: ${userAge ?? 'نامعلوم'}. جنس: ${userGender ?? 'نامعلوم'}.`
        : `Patient symptoms: ${symptoms}. Age: ${userAge ?? 'unknown'}. Gender: ${userGender ?? 'unknown'}.`

    let safeResult: Record<string, unknown> | null = null
    let lastError: Error | null = null
    let usedModel: string | null = null
    let totalLatency = 0
    let inputTokens: number | null = null
    let outputTokens: number | null = null

    for (const model of MODELS) {
      try {
        const call = await callWithTool(
          anthropic,
          model,
          SYSTEM_PROMPT,
          [{ role: 'user', content: userPrompt }],
          ANALYSIS_TOOL,
          'submit_symptom_analysis',
          2000
        )
        usedModel = call.model
        totalLatency = call.latencyMs
        inputTokens = call.inputTokens
        outputTokens = call.outputTokens

        const parsed = parseSymptomAnalysis(call.input)
        if (!parsed.success) {
          await logTrace({
            traceId,
            functionName: 'analyze-symptoms',
            model: usedModel,
            latencyMs: totalLatency,
            status: 'validation_failed',
            errorMessage: parsed.error,
          })
          lastError = new Error(parsed.error)
          continue
        }

        const safe = applySafetyRules(parsed.data, symptoms)
        safeResult = { ...safe, trace_id: traceId }
        break
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.error(`Model ${model} failed:`, lastError.message)
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
