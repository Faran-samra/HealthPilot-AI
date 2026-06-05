import type { InvokeToolParams, ToolCallResult } from '../types.ts'
import { openaiApiKey } from '../env.ts'

/** OpenAI Chat Completions with forced function / tool call (GPT-4o-mini default). */
export async function callOpenAiWithTool(params: InvokeToolParams): Promise<ToolCallResult> {
  const apiKey = openaiApiKey()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured or wrong key type (need sk-..., not Google AQ./AIza)')
  }

  const started = Date.now()
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = await res.json() as {
    choices?: Array<{
      message?: {
        tool_calls?: Array<{ function?: { arguments?: string } }>
      }
    }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }

  const argsRaw = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
  if (!argsRaw) throw new Error('OpenAI: no tool call in response')

  let input: Record<string, unknown>
  try {
    input = JSON.parse(argsRaw) as Record<string, unknown>
  } catch {
    throw new Error('OpenAI: invalid tool arguments JSON')
  }

  return {
    input,
    provider: 'openai',
    model: params.target.model,
    latencyMs: Date.now() - started,
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
  }
}
