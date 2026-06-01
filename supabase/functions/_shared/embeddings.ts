/** Edge RAG — Hugging Face Inference or Railway HF proxy (no local model). */

export const EMBEDDING_DIM = 1024

const HF_API = 'https://api-inference.huggingface.co/pipeline/feature-extraction'

function env(name: string): string | undefined {
  return Deno.env.get(name)
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

async function embedHfQuery(text: string): Promise<number[] | null> {
  const apiKey = hfKey()
  if (!apiKey) return null
  const url = `${HF_API}/${hfModel()}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: text.slice(0, 2000) }),
  })
  if (!res.ok) {
    console.warn('HF embed failed:', res.status, await res.text().catch(() => ''))
    return null
  }
  const data = await res.json()
  const vec = Array.isArray(data) && Array.isArray(data[0]) && typeof data[0][0] !== 'number'
    ? toSentenceEmbedding(data[0])
    : toSentenceEmbedding(data)
  return vec.length === EMBEDDING_DIM ? vec : null
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
  try {
    const useHttp = env('EMBEDDING_PROVIDER') === 'http' || (!hfKey() && env('EMBEDDING_SERVICE_URL'))
    if (useHttp && env('EMBEDDING_SERVICE_URL')) {
      return await embedHttpQuery(text)
    }
    return await embedHfQuery(text)
  } catch (e) {
    console.warn('embedQuery failed:', e)
    return null
  }
}
