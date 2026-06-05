import Anthropic from 'npm:@anthropic-ai/sdk'
import type { InvokeToolParams, ToolCallResult } from '../types.ts'
import { anthropicApiKey } from '../env.ts'

let client: Anthropic | null = null

function getClient(): Anthropic {
  const apiKey = anthropicApiKey()
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured (expected sk-ant-...)')
  if (!client) client = new Anthropic({ apiKey })
  return client
}

/** Claude — reserved for high-risk / complex cases and quality escalation. */
export async function callAnthropicWithTool(params: InvokeToolParams): Promise<ToolCallResult> {
  const anthropic = getClient()
  const started = Date.now()

  const tool: Anthropic.Tool = {
    name: params.tool.name,
    description: params.tool.description,
    input_schema: params.tool.input_schema as Anthropic.Tool.InputSchema,
  }

  const response = await anthropic.messages.create({
    model: params.target.model,
    max_tokens: params.maxTokens,
    system: params.system,
    tools: [tool],
    tool_choice: { type: 'tool', name: params.toolName },
    messages: params.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  })

  const block = response.content.find((b) => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') {
    throw new Error('Claude: no tool_use block in response')
  }

  return {
    input: block.input as Record<string, unknown>,
    provider: 'anthropic',
    model: params.target.model,
    latencyMs: Date.now() - started,
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
  }
}
