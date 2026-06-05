/** Edge RAG — Hugging Face Inference or Railway HF proxy (no local model). */

export const EMBEDDING_DIM = 1024

/** Legacy api-inference.huggingface.co returns 410 — use router (Inference Providers). */
const HF_INFERENCE_BASE =
  Deno.env.get('HF_INFERENCE_BASE')?.replace(/\/$/, '') ??
  'https://router.huggingface.co/hf-inference'

function hfFeatureExtractionUrl(model: string): string {
  return `${HF_INFERENCE_BASE}/models/${model}/pipeline/feature-extraction`
}

function env(name: string): string | undefined {
  return Deno.env.get(name)
}

/** Set RAG_DEBUG=true on the project to log embed/retrieval steps (no vectors or PHI). */
export function isRagDebug(): boolean {
  const v = env('RAG_DEBUG')?.toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function ragDebug(...parts: unknown[]): void {
  if (isRagDebug()) console.log('[RAG]', ...parts)
}

function hfKey(): string | undefined {
  return env('HUGGINGFACE_API_KEY') ?? env('HF_TOKEN')
}

function hfModel(): string {
  return env('HF_EMBEDDING_MODEL') ?? 'BAAI/bge-large-en-v1.5'
}

function httpHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = env('EMBEDDING_API_KEY')
  if (key) headers.Authorization = `Bearer ${key}`
  return headers
}

function l2Normalize(v: number[]): number[] {
  let sum = 0
  for (const x of v) sum += x * x
  const norm = Math.sqrt(sum) || 1
  return v.map((x) => x / norm)
}

function toSentenceEmbedding(raw: unknown): number[] {
  if (!Array.isArray(raw) || !raw.length) throw new Error('Invalid HF response')
  if (typeof raw[0] === 'number') return l2Normalize(raw as number[])
  if (Array.isArray(raw[0]) && typeof (raw[0] as number[])[0] === 'number') {
    const tokens = raw as number[][]
    const dim = tokens[0].length
    const sum = new Array<number>(dim).fill(0)
    for (const tok of tokens) {
      for (let i = 0; i < dim; i++) sum[i] += tok[i]
    }
    const n = tokens.length || 1
    return l2Normalize(sum.map((x) => x / n))
  }
  throw new Error('Unexpected HF shape')
}

function isEdgeRuntime(): boolean {
  return Boolean(Deno.env.get('SUPABASE_URL'))
}

function hfMaxAttempts(): number {
  return isEdgeRuntime() ? 2 : 6
}

function hfRetryWaitMs(attempt: number): number {
  const cap = isEdgeRuntime() ? 2000 : 30_000
  return Math.min(cap, 1500 * (attempt + 1))
}

async function embedHfQuery(
  text: string,
  signal?: AbortSignal
): Promise<{ vec: number[] | null; reason?: string; status?: number }> {
  const apiKey = hfKey()
  if (!apiKey) {
    console.warn('HF embed skipped: HUGGINGFACE_API_KEY not set')
    return { vec: null, reason: 'no_api_key' }
  }

  const url = hfFeatureExtractionUrl(hfModel())
  const body = JSON.stringify({ inputs: text.slice(0, 2000) })
  const maxAttempts = hfMaxAttempts()

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) return { vec: null, reason: 'aborted' }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
      signal,
    })

    if (res.ok) {
      const data = await res.json()
      const vec =
        Array.isArray(data) && Array.isArray(data[0]) && typeof data[0][0] !== 'number'
          ? toSentenceEmbedding(data[0])
          : toSentenceEmbedding(data)
      if (vec.length !== EMBEDDING_DIM) {
        console.warn('HF embed bad dimensions:', vec.length)
        return { vec: null, reason: 'bad_dimensions' }
      }
      return { vec }
    }

    const errText = await res.text().catch(() => '')
    const loading = res.status === 503 || errText.toLowerCase().includes('loading')
    if (loading && attempt < maxAttempts - 1) {
      const waitMs = hfRetryWaitMs(attempt)
      ragDebug('embed:retry', { status: res.status, attempt: attempt + 1, waitMs })
      await new Promise((r) => setTimeout(r, waitMs))
      continue
    }

    console.warn('HF embed failed:', res.status, errText.slice(0, 300))
    return { vec: null, reason: 'hf_http_error', status: res.status }
  }

  return { vec: null, reason: 'hf_retries_exhausted' }
}

async function embedHttpQuery(text: string, signal?: AbortSignal): Promise<number[] | null> {
  const base = env('EMBEDDING_SERVICE_URL')?.replace(/\/$/, '')
  if (!base) return null
  const res = await fetch(`${base}/embed`, {
    method: 'POST',
    headers: httpHeaders(),
    body: JSON.stringify({ query: text.slice(0, 4000) }),
    signal,
  })
  if (!res.ok) return null
  const json = await res.json()
  const v = json?.embedding
  return Array.isArray(v) && v.length === EMBEDDING_DIM ? v : null
}

export async function embedQuery(text: string, signal?: AbortSignal): Promise<number[] | null> {
  const preview = text.trim().slice(0, 120)
  const httpUrl = env('EMBEDDING_SERVICE_URL')
  const hasHf = Boolean(hfKey())
  const preferHttp =
    env('EMBEDDING_PROVIDER') === 'http' || (isEdgeRuntime() && Boolean(httpUrl))

  ragDebug('embed:start', {
    preferHttp,
    hasHf,
    hasHttp: Boolean(httpUrl),
    model: hfModel(),
    queryChars: text.length,
    preview,
  })

  const t0 = Date.now()
  try {
    if (signal?.aborted) {
      ragDebug('embed:aborted', { ms: Date.now() - t0 })
      return null
    }

    const tryHttp = async (): Promise<number[] | null> =>
      httpUrl ? embedHttpQuery(text, signal) : null
    const tryHf = async (): Promise<number[] | null> => {
      if (!hasHf) return null
      const hf = await embedHfQuery(text, signal)
      return hf.vec
    }

    let vec: number[] | null = null
    let failReason: string | undefined

    if (preferHttp) {
      vec = await tryHttp()
      if (!vec && hasHf) vec = await tryHf()
      if (!vec) failReason = 'http_then_hf_failed'
    } else {
      vec = await tryHf()
      if (!vec && httpUrl) vec = await tryHttp()
      if (!vec) failReason = 'hf_then_http_failed'
    }

    if (vec) {
      ragDebug('embed:ok', { dimensions: vec.length, ms: Date.now() - t0 })
    } else {
      ragDebug('embed:empty', { ms: Date.now() - t0, reason: failReason })
    }
    return vec
  } catch (e) {
    console.warn('embedQuery failed:', e)
    ragDebug('embed:error', { ms: Date.now() - t0, error: String(e) })
    return null
  }
}
