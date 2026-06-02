/**
 * Rate-limited HTTP client for public directory ingestion.
 */

export interface FetchOptions {
  headers?: Record<string, string>
  timeoutMs?: number
}

export class RateLimitedHttpClient {
  private lastRequestAt = 0
  private readonly minIntervalMs: number

  constructor(
    private readonly userAgent: string,
    requestsPerSecond = 1,
  ) {
    this.minIntervalMs = Math.ceil(1000 / Math.max(0.1, requestsPerSecond))
  }

  private async throttle(): Promise<void> {
    const now = Date.now()
    const wait = this.lastRequestAt + this.minIntervalMs - now
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    this.lastRequestAt = Date.now()
  }

  async fetchText(url: string, options: FetchOptions = {}): Promise<{ ok: boolean; status: number; text: string }> {
    await this.throttle()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'text/html,application/xml,text/xml,*/*',
          ...options.headers,
        },
      })
      const text = await res.text()
      return { ok: res.ok, status: res.status, text }
    } finally {
      clearTimeout(timeout)
    }
  }
}

/** Parse URLs from sitemap XML (supports sitemap index + urlset). */
export function parseSitemapXml(xml: string): { urls: string[]; sitemapIndexes: string[] } {
  const urls: string[] = []
  const sitemapIndexes: string[] = []
  const locRe = /<loc>\s*([^<]+?)\s*<\/loc>/gi
  let m: RegExpExecArray | null
  while ((m = locRe.exec(xml)) !== null) {
    const loc = m[1].trim()
    if (/<sitemap/i.test(xml) && /sitemap.*\.xml/i.test(loc)) {
      sitemapIndexes.push(loc)
    } else {
      urls.push(loc)
    }
  }
  return { urls, sitemapIndexes }
}

export async function fetchAllSitemapUrls(
  client: RateLimitedHttpClient,
  rootSitemapUrl: string,
  filter?: (url: string) => boolean,
  maxUrls = 50_000,
): Promise<string[]> {
  const seen = new Set<string>()
  const out: string[] = []
  const queue = [rootSitemapUrl]

  while (queue.length > 0 && out.length < maxUrls) {
    const url = queue.shift()!
    if (seen.has(url)) continue
    seen.add(url)

    const { ok, text } = await client.fetchText(url)
    if (!ok) continue

    const { urls, sitemapIndexes } = parseSitemapXml(text)
    for (const idx of sitemapIndexes) {
      if (!seen.has(idx)) queue.push(idx)
    }
    for (const u of urls) {
      if (filter && !filter(u)) continue
      if (!out.includes(u)) out.push(u)
      if (out.length >= maxUrls) break
    }
  }

  return out
}
