import type {
  InvokeChainParams,
  InvokeChainResult,
  InvokeToolParams,
  LlmProvider,
  ModelTarget,
  ToolCallResult,
} from './types.ts'
import { providerHasKey } from './env.ts'
import { callOpenAiWithTool } from './providers/openai.ts'
import { callGeminiWithTool } from './providers/gemini.ts'
import { callGroqWithTool } from './providers/groq.ts'
import { callAnthropicWithTool } from './providers/anthropic.ts'

function targetLabel(t: ModelTarget): string {
  return `${t.provider}:${t.model}`
}

async function invokeOne(params: InvokeToolParams): Promise<ToolCallResult> {
  switch (params.target.provider) {
    case 'openai':
      return callOpenAiWithTool(params)
    case 'gemini':
      return callGeminiWithTool(params)
    case 'groq':
      return callGroqWithTool(params)
    case 'anthropic':
      return callAnthropicWithTool(params)
  }
}

export function filterAvailableChain(chain: readonly ModelTarget[]): ModelTarget[] {
  const seen = new Set<string>()
  const out: ModelTarget[] = []
  for (const t of chain) {
    if (!providerHasKey(t.provider)) continue
    const key = `${t.provider}:${t.model}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

/** Try models in order; skip providers without API keys. */
export async function invokeWithToolChain(
  params: InvokeChainParams
): Promise<InvokeChainResult> {
  const chain = filterAvailableChain(params.chain)
  if (chain.length === 0) {
    throw new Error('No LLM providers available for the requested model chain')
  }

  const attempts: string[] = []
  let lastError: Error | null = null
  const limit = Math.min(chain.length, Math.max(1, params.maxAttempts ?? chain.length))

  for (let i = 0; i < limit; i++) {
    const target = chain[i]
    const label = targetLabel(target)
    const hasMoreProviders = i < limit - 1
    try {
      const result = await invokeOne({
        system: params.system,
        messages: params.messages,
        tool: params.tool,
        toolName: params.toolName,
        maxTokens: params.maxTokens,
        target,
        allowGroqJsonFallback: !hasMoreProviders,
      })
      attempts.push(`${label}:ok:${result.latencyMs}ms`)
      return { ...result, attempts }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const short =
        /429|rate_limit|rate limit exceeded/i.test(msg) ? 'rate_limited' : msg.slice(0, 80)
      attempts.push(`${label}:fail:${short}`)
      lastError = err instanceof Error ? err : new Error(msg)
    }
  }

  throw lastError ?? new Error(`All models failed: ${attempts.join(' | ')}`)
}

export function isClaudeTarget(t: ModelTarget): boolean {
  return t.provider === 'anthropic'
}

export function formatModelUsed(result: ToolCallResult): string {
  return `${result.provider}/${result.model}`
}
