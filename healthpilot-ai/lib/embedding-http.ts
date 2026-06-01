/** Shared headers for POST /embed (Node + documented for Edge). */

function env(name: string): string | undefined {
  const d = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno
  if (d?.env?.get) return d.env.get(name)
  return process.env[name]
}

export function embeddingHttpHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = env('EMBEDDING_API_KEY')
  if (key) headers.Authorization = `Bearer ${key}`
  return headers
}
