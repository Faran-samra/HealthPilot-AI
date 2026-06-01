import { createClient } from 'npm:@supabase/supabase-js'

export interface TracePayload {
  traceId: string
  functionName: string
  model?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  latencyMs: number
  status: 'ok' | 'error' | 'validation_failed'
  errorMessage?: string | null
  userId?: string | null
  sessionId?: string | null
}

export function createTraceId(): string {
  return crypto.randomUUID()
}

export async function logTrace(payload: TracePayload): Promise<void> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    console.warn('Trace logging skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set')
    return
  }

  try {
    const supabase = createClient(url, key)
    await supabase.from('ai_traces').insert({
      trace_id: payload.traceId,
      function_name: payload.functionName,
      model: payload.model ?? null,
      input_tokens: payload.inputTokens ?? null,
      output_tokens: payload.outputTokens ?? null,
      latency_ms: payload.latencyMs,
      status: payload.status,
      error_message: payload.errorMessage ?? null,
      user_id: payload.userId ?? null,
      session_id: payload.sessionId ?? null,
    })
  } catch (err) {
    console.error('logTrace failed:', err)
  }
}
