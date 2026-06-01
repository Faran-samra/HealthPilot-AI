import Anthropic from 'npm:@anthropic-ai/sdk'

export interface ToolCallResult {
  input: Record<string, unknown>
  model: string
  latencyMs: number
  inputTokens: number | null
  outputTokens: number | null
}

export async function callWithTool(
  anthropic: Anthropic,
  model: string,
  system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  tool: Anthropic.Tool,
  toolName: string,
  maxTokens: number
): Promise<ToolCallResult> {
  const started = Date.now()
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    tools: [tool],
    tool_choice: { type: 'tool', name: toolName },
    messages,
  })

  const block = response.content.find((b) => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') {
    throw new Error('Invalid AI response: no tool_use block')
  }

  return {
    input: block.input as Record<string, unknown>,
    model,
    latencyMs: Date.now() - started,
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
  }
}
