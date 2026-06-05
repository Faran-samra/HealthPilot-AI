import { sleep } from './fs.ts'

export function formatSeedError(err: unknown): string {
  if (err instanceof Error) {
    const cause = err.cause instanceof Error ? err.cause.message : String(err.cause ?? '')
    return cause ? `${err.message} (${cause})` : err.message
  }
  return String(err)
}

export async function withSeedRetry<T>(
  label: string,
  fn: () => Promise<{ data: T | null; error: { message: string } | null }>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<{ data: T | null; error: { message: string } | null }> {
  const maxAttempts = opts.maxAttempts ?? 6
  const baseDelayMs = opts.baseDelayMs ?? 1500

  let lastError: { message: string } | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn()
      if (!result.error) return result
      lastError = result.error
      const retryable =
        /fetch failed|timeout|ECONNRESET|ETIMEDOUT|socket|network|502|503|504|429/i.test(
          result.error.message
        )
      if (!retryable || attempt === maxAttempts) return result
      console.warn(`  ${label}: ${result.error.message} — retry ${attempt}/${maxAttempts}`)
    } catch (e) {
      const msg = formatSeedError(e)
      lastError = { message: msg }
      if (attempt === maxAttempts) return { data: null, error: lastError }
      console.warn(`  ${label}: ${msg} — retry ${attempt}/${maxAttempts}`)
    }
    await sleep(baseDelayMs * attempt)
  }
  return { data: null, error: lastError ?? { message: 'unknown error' } }
}

/** Split array into batches where JSON payload stays under maxBytes. */
export function batchByPayloadSize<T>(
  items: T[],
  toJson: (item: T) => object,
  maxBytes: number
): T[][] {
  const batches: T[][] = []
  let current: T[] = []
  let size = 2 // []

  for (const item of items) {
    const bytes = Buffer.byteLength(JSON.stringify(toJson(item)), 'utf8')
    if (current.length > 0 && size + bytes + 1 > maxBytes) {
      batches.push(current)
      current = []
      size = 2
    }
    current.push(item)
    size += bytes + 1
  }
  if (current.length) batches.push(current)
  return batches
}
