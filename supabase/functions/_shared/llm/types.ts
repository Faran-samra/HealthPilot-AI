/** Provider-agnostic LLM types — core app does not depend on a single vendor. */

export type LlmProvider = 'openai' | 'gemini' | 'groq' | 'anthropic'

export interface ModelTarget {
  provider: LlmProvider
  model: string
}

export interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ToolCallResult {
  input: Record<string, unknown>
  provider: LlmProvider
  model: string
  latencyMs: number
  inputTokens: number | null
  outputTokens: number | null
}

export interface InvokeToolParams {
  system: string
  messages: ChatTurn[]
  tool: ToolDefinition
  toolName: string
  maxTokens: number
  target: ModelTarget
  /** When false, Groq skips a second JSON request and fails over to the next provider. */
  allowGroqJsonFallback?: boolean
}

export interface InvokeChainParams {
  system: string
  messages: ChatTurn[]
  tool: ToolDefinition
  toolName: string
  maxTokens: number
  chain: readonly ModelTarget[]
  /** Cap provider attempts — avoids CPU/time limits on Edge (default: full chain). */
  maxAttempts?: number
}

export interface InvokeChainResult extends ToolCallResult {
  attempts: string[]
}
