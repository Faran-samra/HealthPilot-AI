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

async function embedHfQuery(text: string): Promise<{ vec: number[] | null; reason?: string; status?: number }> {
  const apiKey = hfKey()
  if (!apiKey) {
    console.warn('HF embed skipped: HUGGINGFACE_API_KEY not set')
    return { vec: null, reason: 'no_api_key' }
  }

  const url = hfFeatureExtractionUrl(hfModel())
  const body = JSON.stringify({ inputs: text.slice(0, 2000) })

  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
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
    if (loading && attempt < 5) {
      const waitMs = Math.min(30_000, 5000 * (attempt + 1))
      ragDebug('embed:retry', { status: res.status, attempt: attempt + 1, waitMs })
      await new Promise((r) => setTimeout(r, waitMs))
      continue
    }

    console.warn('HF embed failed:', res.status, errText.slice(0, 300))
    return { vec: null, reason: 'hf_http_error', status: res.status }
  }

  return { vec: null, reason: 'hf_retries_exhausted' }
}

async function embedHttpQuery(text: string): Promise<number[] | null> {
  const base = env('EMBEDDING_SERVICE_URL')?.replace(/\/$/, '')
  if (!base) return null
  const res = await fetch(`${base}/embed`, {
    method: 'POST',
    headers: httpHeaders(),
    body: JSON.stringify({ query: text.slice(0, 4000) }),
  })
  if (!res.ok) return null
  const json = await res.json()
  const v = json?.embedding
  return Array.isArray(v) && v.length === EMBEDDING_DIM ? v : null
}

export async function embedQuery(text: string): Promise<number[] | null> {
  const preview = text.trim().slice(0, 120)
  const provider =
    env('EMBEDDING_PROVIDER') === 'http' || (!hfKey() && env('EMBEDDING_SERVICE_URL')) ? 'http' : 'huggingface'
  ragDebug('embed:start', { provider, model: hfModel(), queryChars: text.length, preview })

  const t0 = Date.now()
  try {
    const useHttp = env('EMBEDDING_PROVIDER') === 'http' || (!hfKey() && env('EMBEDDING_SERVICE_URL'))
    let vec: number[] | null = null
    let failReason: string | undefined
    if (useHttp && env('EMBEDDING_SERVICE_URL')) {
      vec = await embedHttpQuery(text)
      if (!vec) failReason = 'http_embed_failed'
    } else {
      const hf = await embedHfQuery(text)
      vec = hf.vec
      failReason = hf.reason
      if (hf.status) failReason = `${failReason ?? 'hf_error'}:${hf.status}`
    }
    if (vec) {
      ragDebug('embed:ok', { provider, dimensions: vec.length, ms: Date.now() - t0 })
    } else {
      ragDebug('embed:empty', { provider, ms: Date.now() - t0, reason: failReason })
    }
    return vec
  } catch (e) {
    console.warn('embedQuery failed:', e)
    ragDebug('embed:error', { provider, ms: Date.now() - t0, error: String(e) })
    return null
  }
}
