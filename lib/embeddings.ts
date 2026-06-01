/** Embeddings for RAG — 1024 dims (matches medical_chunks.embedding). */

import { embeddingHttpHeaders } from './embedding-http.ts'

export const EMBEDDING_DIM = 1024

export type EmbeddingProvider = 'local' | 'http' | 'openai' | 'voyage'
export type EmbeddingInputType = 'query' | 'document'

function env(name: string): string | undefined {
  const d = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno
  if (d?.env?.get) return d.env.get(name)
  return process.env[name]
}

export function resolveEmbeddingProvider(): EmbeddingProvider {
  const explicit = env('EMBEDDING_PROVIDER')?.toLowerCase()
  if (explicit === 'local' || explicit === 'http' || explicit === 'voyage' || explicit === 'openai') {
    return explicit
  }
  if (env('EMBEDDING_SERVICE_URL')) return 'http'
  if (env('VOYAGE_API_KEY')) return 'voyage'
  if (env('OPENAI_API_KEY')) return 'openai'
  return 'local'
}

export function embeddingModelFor(provider: EmbeddingProvider): string {
  if (provider === 'voyage') return env('VOYAGE_EMBEDDING_MODEL') ?? 'voyage-3'
  if (provider === 'local') return 'Xenova/bge-large-en-v1.5'
  if (provider === 'http') return 'BAAI/bge-large-en-v1.5'
  return env('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small'
}

function voyageSupportsOutputDimension(model: string): boolean {
  return !model.includes('voyage-3-lite') && model !== 'voyage-3'
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  provider: EmbeddingProvider,
  maxRetries = 5
): Promise<Response> {
  let lastErr: EmbeddingApiError | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init)
    if (res.ok) return res
    const errText = await res.text()
    lastErr = new EmbeddingApiError(provider, res.status, errText)
    if (res.status === 429 && attempt < maxRetries) {
      const waitMs = Math.min(90_000, 22_000 * (attempt + 1))
      console.warn(`Rate limited (${provider}), retry in ${Math.round(waitMs / 1000)}s...`)
      await sleep(waitMs)
      continue
    }
    throw lastErr
  }
  throw lastErr!
}

async function embedViaHttp(text: string, inputType: EmbeddingInputType): Promise<number[]> {
  const base = env('EMBEDDING_SERVICE_URL')?.replace(/\/$/, '')
  if (!base) throw new Error('EMBEDDING_SERVICE_URL required when EMBEDDING_PROVIDER=http')

  const res = await fetch(`${base}/embed`, {
    method: 'POST',
    headers: embeddingHttpHeaders(),
    body: JSON.stringify(
      inputType === 'query' ? { query: text } : { texts: [text.slice(0, 8000)] }
    ),
  })
  if (!res.ok) throw new Error(`Embed service ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (inputType === 'query') return json.embedding as number[]
  const batch = json.embeddings as number[][]
  if (!batch?.[0]) throw new Error('Invalid embed service response')
  return batch[0]
}

async function embedOpenAIMany(texts: string[]): Promise<number[][]> {
  const apiKey = env('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY required')

  const res = await fetchWithRetry(
    'https://api.openai.com/v1/embeddings',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: embeddingModelFor('openai'),
        input: texts.map((t) => t.slice(0, 8000)),
        dimensions: EMBEDDING_DIM,
      }),
    },
    'openai'
  )

  const json = await res.json()
  const items = json?.data as { index: number; embedding: number[] }[] | undefined
  if (!items?.length) throw new Error('Invalid OpenAI embedding response')
  return items.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}

async function embedVoyageMany(texts: string[], inputType: EmbeddingInputType): Promise<number[][]> {
  const apiKey = env('VOYAGE_API_KEY')
  if (!apiKey) throw new Error('VOYAGE_API_KEY required')

  const model = embeddingModelFor('voyage')
  const body: Record<string, unknown> = {
    model,
    input: texts.map((t) => t.slice(0, 32000)),
    input_type: inputType === 'query' ? 'query' : 'document',
  }
  if (voyageSupportsOutputDimension(model)) {
    body.output_dimension = EMBEDDING_DIM
  }

  const res = await fetchWithRetry(
    'https://api.voyageai.com/v1/embeddings',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    'voyage'
  )

  const json = await res.json()
  const rows = json?.data as { embedding: number[] }[] | undefined
  if (!rows?.length) throw new Error('Invalid Voyage embedding response')
  return rows.map((r) => {
    if (r.embedding.length !== EMBEDDING_DIM) {
      throw new Error(`Expected ${EMBEDDING_DIM} dims, got ${r.embedding.length}. Use voyage-3.`)
    }
    return r.embedding
  })
}

export class EmbeddingApiError extends Error {
  constructor(
    readonly provider: EmbeddingProvider,
    readonly status: number,
    readonly body: string
  ) {
    super(`Embedding failed (${provider}): ${status} ${body.slice(0, 500)}`)
    this.name = 'EmbeddingApiError'
  }

  get isQuotaOrAuth(): boolean {
    return (
      this.status === 401 ||
      this.status === 403 ||
      this.status === 429 ||
      this.body.includes('insufficient_quota') ||
      this.body.includes('insufficient balance')
    )
  }
}

/** Embed many texts in one call (API) or one local batch. */
export async function embedTextsBatch(
  texts: string[],
  options?: { inputType?: EmbeddingInputType; provider?: EmbeddingProvider; localBatchSize?: number }
): Promise<number[][]> {
  if (!texts.length) return []
  const provider = options?.provider ?? resolveEmbeddingProvider()
  const inputType = options?.inputType ?? 'document'

  if (provider === 'local') {
    const { embedLocalBatch } = await import('./embeddings-local.ts')
    return embedLocalBatch(texts, options?.localBatchSize ?? 32)
  }
  if (provider === 'http') {
    const base = env('EMBEDDING_SERVICE_URL')?.replace(/\/$/, '')
    if (!base) throw new Error('EMBEDDING_SERVICE_URL required')
    const res = await fetch(`${base}/embed`, {
      method: 'POST',
      headers: embeddingHttpHeaders(),
      body: JSON.stringify({ texts: texts.map((t) => t.slice(0, 8000)) }),
    })
    if (!res.ok) throw new Error(`Embed service ${res.status}`)
    const json = await res.json()
    return json.embeddings as number[][]
  }
  if (provider === 'voyage') return embedVoyageMany(texts, inputType)
  return embedOpenAIMany(texts)
}

export async function embedText(
  text: string,
  options?: { inputType?: EmbeddingInputType; provider?: EmbeddingProvider }
): Promise<number[]> {
  const [one] = await embedTextsBatch([text], options)
  return one
}

export async function embedQuery(text: string): Promise<number[] | null> {
  try {
    const provider = resolveEmbeddingProvider()
    if (provider === 'local') {
      const { embedLocalQuery } = await import('./embeddings-local.ts')
      return await embedLocalQuery(text)
    }
    if (provider === 'http') {
      return await embedViaHttp(text, 'query')
    }
    const [v] = await embedTextsBatch([text], { inputType: 'query', provider })
    return v
  } catch (e) {
    console.warn('embedQuery failed:', e instanceof Error ? e.message : e)
    return null
  }
}

/** Delay between API embed batches (not used for local). */
export function embedThrottleMs(provider?: EmbeddingProvider): number {
  const p = provider ?? resolveEmbeddingProvider()
  if (p === 'local' || p === 'http') return 0
  if (p === 'voyage') {
    const custom = env('VOYAGE_EMBED_DELAY_MS')
    if (custom) return Number(custom)
    return 500
  }
  return 100
}
