/** Edge RAG embeddings — calls hosted FastAPI service or cloud APIs. */

export const EMBEDDING_DIM = 1024

function env(name: string): string | undefined {
  return Deno.env.get(name)
}

function httpHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = env('EMBEDDING_API_KEY')
  if (key) headers.Authorization = `Bearer ${key}`
  return headers
}

function resolveProvider(): 'http' | 'voyage' | 'openai' {
  const explicit = env('EMBEDDING_PROVIDER')?.toLowerCase()
  if (explicit === 'http' || explicit === 'local') return 'http'
  if (explicit === 'voyage') return 'voyage'
  if (explicit === 'openai') return 'openai'
  if (env('EMBEDDING_SERVICE_URL')) return 'http'
  if (env('VOYAGE_API_KEY')) return 'voyage'
  if (env('OPENAI_API_KEY')) return 'openai'
  return 'http'
}

async function embedHttpQuery(text: string): Promise<number[] | null> {
  const base = env('EMBEDDING_SERVICE_URL')?.replace(/\/$/, '')
  if (!base) {
    console.warn('RAG: set EMBEDDING_SERVICE_URL (FastAPI embed service HTTPS URL)')
    return null
  }
  const res = await fetch(`${base}/embed`, {
    method: 'POST',
    headers: httpHeaders(),
    body: JSON.stringify({ query: text.slice(0, 4000) }),
  })
  if (!res.ok) {
    console.warn('RAG embed HTTP failed:', res.status, await res.text().catch(() => ''))
    return null
  }
  const json = await res.json()
  const v = json?.embedding
  return Array.isArray(v) && v.length === EMBEDDING_DIM ? v : null
}

async function embedVoyageQuery(text: string): Promise<number[] | null> {
  const apiKey = env('VOYAGE_API_KEY')
  if (!apiKey) return null
  const model = env('VOYAGE_EMBEDDING_MODEL') ?? 'voyage-3'
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text.slice(0, 32000),
      input_type: 'query',
    }),
  })
  if (!res.ok) return null
  const json = await res.json()
  const v = json?.data?.[0]?.embedding
  return Array.isArray(v) && v.length === EMBEDDING_DIM ? v : null
}

async function embedOpenAIQuery(text: string): Promise<number[] | null> {
  const apiKey = env('OPENAI_API_KEY')
  if (!apiKey) return null
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small',
      input: text.slice(0, 8000),
      dimensions: EMBEDDING_DIM,
    }),
  })
  if (!res.ok) return null
  const json = await res.json()
  return json?.data?.[0]?.embedding ?? null
}

export async function embedQuery(text: string): Promise<number[] | null> {
  try {
    const p = resolveProvider()
    if (p === 'http') return await embedHttpQuery(text)
    if (p === 'voyage') return await embedVoyageQuery(text)
    return await embedOpenAIQuery(text)
  } catch (e) {
    console.warn('embedQuery failed:', e)
    return null
  }
}
