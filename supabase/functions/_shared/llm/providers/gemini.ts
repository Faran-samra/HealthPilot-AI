import type { InvokeToolParams, ToolCallResult } from '../types.ts'
import { geminiApiKey, geminiModelCandidates } from '../env.ts'
import { toolSchemaForGemini } from '../gemini-schema.ts'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

function extractToolInput(
  parts: Array<{ text?: string; functionCall?: { name?: string; args?: Record<string, unknown> } }> | undefined,
  toolName: string
): Record<string, unknown> | null {
  if (!parts?.length) return null

  for (const p of parts) {
    if (p.functionCall?.name === toolName && p.functionCall.args && typeof p.functionCall.args === 'object') {
      return p.functionCall.args
    }
  }
  for (const p of parts) {
    if (p.functionCall?.args && typeof p.functionCall.args === 'object') {
      return p.functionCall.args
    }
  }

  const text = parts.map((p) => p.text).filter(Boolean).join('\n')
  if (!text) return null

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    return JSON.parse(jsonMatch[0]) as Record<string, unknown>
  } catch {
    return null
  }
}

async function generateWithModel(
  apiKey: string,
  model: string,
  params: InvokeToolParams
): Promise<ToolCallResult> {
  const started = Date.now()
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent`

  const toolInstruction =
    `\n\nIMPORTANT: You must reply ONLY by calling the function "${params.toolName}" with valid JSON arguments. Do not output plain text or markdown.`

  const contents = params.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: params.system + toolInstruction }] },
      contents,
      tools: [
        {
          functionDeclarations: [
            {
              name: params.tool.name,
              description: params.tool.description,
              parameters: toolSchemaForGemini(params.tool.input_schema),
            },
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: [params.toolName],
        },
      },
      generationConfig: {
        maxOutputTokens: params.maxTokens,
        temperature: 0.2,
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini ${model} ${res.status}: ${errText.slice(0, 400)}`)
  }

  const data = await res.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string
          functionCall?: { name?: string; args?: Record<string, unknown> }
        }>
      }
      finishReason?: string
    }>
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  }

  const parts = data.candidates?.[0]?.content?.parts
  const input = extractToolInput(parts, params.toolName)
  if (!input) {
    const finish = data.candidates?.[0]?.finishReason ?? 'unknown'
    throw new Error(`Gemini ${model}: no function call in response (finish=${finish})`)
  }

  return {
    input,
    provider: 'gemini',
    model,
    latencyMs: Date.now() - started,
    inputTokens: data.usageMetadata?.promptTokenCount ?? null,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
  }
}

export async function callGeminiWithTool(params: InvokeToolParams): Promise<ToolCallResult> {
  const apiKey = geminiApiKey()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured or wrong key type (use Google AI Studio key, not sk- OpenAI)')
  }

  const candidates = geminiModelCandidates()
  const requested = params.target.model
  const modelsToTry = [requested, ...candidates.filter((m) => m !== requested)]

  let lastError: Error | null = null
  for (const model of modelsToTry) {
    try {
      return await generateWithModel(apiKey, model, params)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const msg = lastError.message
      const retryable =
        msg.includes('404') ||
        msg.includes('503') ||
        msg.includes('no longer available') ||
        msg.includes('overloaded') ||
        msg.includes('no function call')
      if (!retryable) throw lastError
    }
  }

  throw lastError ?? new Error('Gemini: all model candidates failed')
}
