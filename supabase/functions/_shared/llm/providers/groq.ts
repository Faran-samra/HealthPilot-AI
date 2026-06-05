import type { InvokeToolParams, ToolCallResult } from '../types.ts'
import { groqApiKey } from '../env.ts'
import { normalizeSymptomAnalysisRaw } from '../../analysis-normalize.ts'

export function isGroqRateLimitError(msg: string): boolean {
  return /429|rate_limit|rate limit exceeded|tokens per minute/i.test(msg)
}

/** Groq OpenAI-compatible API — Llama 3.x fallback when primary providers fail. */
export async function callGroqWithTool(params: InvokeToolParams): Promise<ToolCallResult> {
  const apiKey = groqApiKey()
  if (!apiKey) throw new Error('GROQ_API_KEY not configured (expected gsk_...)')

  try {
    return await groqToolRequest(apiKey, params)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (isGroqRateLimitError(msg)) {
      throw err instanceof Error ? err : new Error(msg)
    }
    if (
      /tool call validation failed|tool_use_failed|no tool call in response|invalid tool arguments/i.test(
        msg
      )
    ) {
      if (params.toolName === 'ask_follow_up') {
        const fromFailed = parseAskFollowUpFromGroqError(msg)
        if (fromFailed) {
          return {
            input: fromFailed,
            provider: 'groq',
            model: params.target.model,
            latencyMs: 0,
            inputTokens: null,
            outputTokens: null,
          }
        }
      }
      if (params.allowGroqJsonFallback) {
        if (params.toolName === 'submit_symptom_analysis') {
          return await groqJsonAnalysisFallback(apiKey, params)
        }
        if (params.toolName === 'ask_follow_up') {
          return await groqJsonFollowUpFallback(apiKey, params)
        }
      }
      throw new Error('Groq: tool validation failed')
    }
    throw err
  }
}

const FOLLOW_UP_SEVERITIES = new Set(['mild', 'moderate', 'severe', 'emergency'])

/** Groq returns model output in error.failed_generation when tool_use_failed. */
export function parseAskFollowUpFromGroqError(errMsg: string): Record<string, string> | null {
  const jsonStart = errMsg.indexOf('{')
  if (jsonStart >= 0) {
    try {
      const body = JSON.parse(errMsg.slice(jsonStart)) as {
        error?: { failed_generation?: string }
      }
      const failed = body.error?.failed_generation
      if (failed) {
        const parsed = parseAskFollowUpFromFailedGeneration(failed)
        if (parsed) return parsed
      }
    } catch {
      /* try regex on raw message */
    }
  }
  const inline = parseAskFollowUpFromFailedGeneration(errMsg)
  return inline
}

export function parseAskFollowUpFromFailedGeneration(text: string): Record<string, string> | null {
  const cleaned = text.replace(/\\u003c/gi, '<').replace(/\\u003e/gi, '>').trim()
  const fnMatch = cleaned.match(
    /<function=ask_follow_up>\s*message=(.+?),\s*quick_severity=(mild|moderate|severe|emergency)\s*<\/function>/is
  )
  if (fnMatch) {
    return normalizeFollowUpInput(fnMatch[1].trim(), fnMatch[2])
  }
  const loose = cleaned.match(
    /message=(.+?),\s*quick_severity=(mild|moderate|severe|emergency)/is
  )
  if (loose) {
    return normalizeFollowUpInput(loose[1].trim(), loose[2])
  }
  return null
}

function normalizeFollowUpInput(message: string, severity: string): Record<string, string> | null {
  const msg = message.trim()
  const sev = severity.toLowerCase()
  if (!msg || !FOLLOW_UP_SEVERITIES.has(sev)) return null
  return { message: msg, quick_severity: sev }
}

async function groqToolRequest(
  apiKey: string,
  params: InvokeToolParams
): Promise<ToolCallResult> {
  const started = Date.now()
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.target.model,
      max_tokens: params.maxTokens,
      messages: [
        { role: 'system', content: params.system },
        ...params.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: params.tool.name,
            description: params.tool.description,
            parameters: params.tool.input_schema,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: params.toolName } },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    if (isGroqRateLimitError(`${res.status} ${errText}`)) {
      throw new Error(`Groq rate limited (${res.status})`)
    }
    throw new Error(`Groq/Llama ${res.status}: ${errText.slice(0, 400)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: {
        tool_calls?: Array<{ function?: { arguments?: string } }>
        content?: string
      }
    }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }

  const argsRaw = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
  if (!argsRaw) throw new Error('Groq: no tool call in response')

  let input: Record<string, unknown>
  try {
    input = JSON.parse(argsRaw) as Record<string, unknown>
  } catch {
    throw new Error('Groq: invalid tool arguments JSON')
  }

  return {
    input: normalizeGroqAnalysisInput(input, params.toolName),
    provider: 'groq',
    model: params.target.model,
    latencyMs: Date.now() - started,
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
  }
}

function normalizeGroqAnalysisInput(
  input: Record<string, unknown>,
  toolName: string
): Record<string, unknown> {
  if (toolName !== 'submit_symptom_analysis') return input
  return normalizeSymptomAnalysisRaw(input) ?? input
}

/** When strict tool validation fails, ask for plain JSON (same fields, no tool schema). */
async function groqJsonAnalysisFallback(
  apiKey: string,
  params: InvokeToolParams
): Promise<ToolCallResult> {
  const started = Date.now()
  const jsonHint = `Respond with ONLY a single JSON object (no markdown). Required keys: brief_summary, possible_conditions (string, semicolon-separated), recommended_specialty_slug, severity_level, explanation, first_aid_tips (string, semicolon-separated), red_flags (string, semicolon-separated), disclaimer, urdu_summary. Optional: primary_condition, condition_confidence.`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.target.model,
      max_tokens: params.maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${params.system}\n\n${jsonHint}` },
        ...params.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    if (isGroqRateLimitError(`${res.status} ${errText}`)) {
      throw new Error(`Groq rate limited (${res.status})`)
    }
    throw new Error(`Groq JSON fallback ${res.status}: ${errText.slice(0, 400)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }

  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Groq JSON fallback: empty response')

  let input: Record<string, unknown>
  try {
    input = JSON.parse(content) as Record<string, unknown>
  } catch {
    throw new Error('Groq JSON fallback: invalid JSON body')
  }

  const normalized = normalizeSymptomAnalysisRaw(input)
  if (!normalized) throw new Error('Groq JSON fallback: could not normalize analysis')

  return {
    input: normalized,
    provider: 'groq',
    model: params.target.model,
    latencyMs: Date.now() - started,
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
  }
}

/** Plain JSON when Llama emits pseudo-XML instead of a tool call. */
async function groqJsonFollowUpFallback(
  apiKey: string,
  params: InvokeToolParams
): Promise<ToolCallResult> {
  const started = Date.now()
  const jsonHint =
    'Respond with ONLY a JSON object (no markdown): {"message": "one short follow-up question", "quick_severity": "mild" | "moderate" | "severe" | "emergency"}'

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.target.model,
      max_tokens: Math.min(params.maxTokens, 512),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${params.system}\n\n${jsonHint}` },
        ...params.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    if (isGroqRateLimitError(`${res.status} ${errText}`)) {
      throw new Error(`Groq rate limited (${res.status})`)
    }
    throw new Error(`Groq follow-up JSON fallback ${res.status}: ${errText.slice(0, 400)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; output_tokens?: number }
  }

  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Groq follow-up JSON fallback: empty response')

  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(content) as Record<string, unknown>
  } catch {
    throw new Error('Groq follow-up JSON fallback: invalid JSON')
  }

  const message = typeof raw.message === 'string' ? raw.message.trim() : ''
  const quick_severity =
    typeof raw.quick_severity === 'string' ? raw.quick_severity.toLowerCase() : 'moderate'
  const normalized = normalizeFollowUpInput(message, quick_severity)
  if (!normalized) throw new Error('Groq follow-up JSON fallback: missing message or severity')

  return {
    input: normalized,
    provider: 'groq',
    model: params.target.model,
    latencyMs: Date.now() - started,
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.output_tokens ?? null,
  }
}
