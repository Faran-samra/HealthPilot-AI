/**
 * Hugging Face Inference API — BGE-large-en-v1.5 (1024 dims).
 * No local model; works in Node (ingest) and can be called from Railway FastAPI.
 */

const EMBEDDING_DIM = 1024

const HF_API = 'https://api-inference.huggingface.co/pipeline/feature-extraction'

function env(name: string): string | undefined {
  const d = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno
  if (d?.env?.get) return d.env.get(name)
  return process.env[name]
}

export function hfApiKey(): string | undefined {
  return env('HUGGINGFACE_API_KEY') ?? env('HF_TOKEN')
}

export function hfModel(): string {
  return env('HF_EMBEDDING_MODEL') ?? 'BAAI/bge-large-en-v1.5'
}

function l2Normalize(v: number[]): number[] {
  let sum = 0
  for (const x of v) sum += x * x
  const norm = Math.sqrt(sum) || 1
  return v.map((x) => x / norm)
}

/** Mean-pool token vectors and L2-normalize (BGE-style). */
function toSentenceEmbedding(raw: unknown): number[] {
  if (!Array.isArray(raw)) throw new Error('Invalid HF embedding response')

  // Already a flat sentence vector
  if (raw.length > 0 && typeof raw[0] === 'number') {
    return l2Normalize(raw as number[])
  }

  // Token matrix [[dim], [dim], ...]
  if (raw.length > 0 && Array.isArray(raw[0]) && typeof raw[0][0] === 'number') {
    const tokens = raw as number[][]
    const dim = tokens[0].length
    const sum = new Array<number>(dim).fill(0)
    for (const tok of tokens) {
      for (let i = 0; i < dim; i++) sum[i] += tok[i]
    }
    const n = tokens.length || 1
    return l2Normalize(sum.map((x) => x / n))
  }

  throw new Error('Unexpected HF embedding shape')
}

function parseBatchResponse(data: unknown, count: number): number[][] {
  if (!Array.isArray(data)) throw new Error('Invalid HF batch response')
  if (count === 1 && (typeof data[0] === 'number' || Array.isArray(data[0]))) {
    return [toSentenceEmbedding(data)]
  }
  return data.map((item) => toSentenceEmbedding(item))
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function embedHfTexts(texts: string[], maxRetries = 8): Promise<number[][]> {
  const apiKey = hfApiKey()
  if (!apiKey) throw new Error('HUGGINGFACE_API_KEY or HF_TOKEN required')

  const model = hfModel()
  const url = `${HF_API}/${model}`
  const inputs = texts.map((t) => t.slice(0, 2000))

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs }),
    })

    if (res.ok) {
      const data = await res.json()
      const vectors = parseBatchResponse(data, inputs.length)
      for (const v of vectors) {
        if (v.length !== EMBEDDING_DIM) {
          throw new Error(`HF returned ${v.length} dims, expected ${EMBEDDING_DIM}`)
        }
      }
      return vectors
    }

    const body = await res.text()
    const loading = res.status === 503 || body.includes('loading')
    if (loading && attempt < maxRetries) {
      let waitMs = 10_000
      try {
        const j = JSON.parse(body) as { estimated_time?: number }
        if (j.estimated_time) waitMs = Math.min(60_000, j.estimated_time * 1000 + 2000)
      } catch {
        /* ignore */
      }
      console.warn(`HF model loading, retry in ${Math.round(waitMs / 1000)}s...`)
      await sleep(waitMs)
      continue
    }

    throw new Error(`HuggingFace embedding failed: ${res.status} ${body.slice(0, 400)}`)
  }

  throw new Error('HuggingFace embedding failed after retries')
}
