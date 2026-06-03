import type { SupabaseClient } from '@supabase/supabase-js'
import { RateLimitedHttpClient } from '../lib/http-client.ts'
import type { ConnectorConfig, ProfileFetchResult, RawImportRecord } from '../lib/types.ts'
import type { DoctorSource, NormalizedDoctorRow } from '../lib/normalize.ts'

export abstract class BaseSourceConnector {
  readonly http: RateLimitedHttpClient

  constructor(
    protected readonly supabase: SupabaseClient,
    protected readonly config: ConnectorConfig,
  ) {
    this.http = new RateLimitedHttpClient(config.userAgent, config.requestsPerSecond)
  }

  abstract get source(): DoctorSource

  /** Root sitemap URL(s) for this source. */
  abstract getSitemapRoots(): string[]

  /** Whether a sitemap/loc URL is a doctor profile page. */
  abstract isProfileUrl(url: string): boolean

  /** Stable external ID from profile URL. */
  abstract externalIdFromUrl(url: string): string

  /** Parse profile page HTML into normalized row (metadata only). */
  abstract parseProfileHtml(url: string, html: string): NormalizedDoctorRow | null

  /** Optional: enrich from URL path when HTML fetch fails. */
  parseProfileFromUrl(_url: string): NormalizedDoctorRow | null {
    return null
  }

  filterSitemapUrl(url: string): boolean {
    return this.isProfileUrl(url)
  }

  async harvestSitemapUrls(maxUrls = 10_000): Promise<string[]> {
    const { fetchAllSitemapUrls } = await import('../lib/http-client.ts')
    const all: string[] = []
    for (const root of this.getSitemapRoots()) {
      const urls = await fetchAllSitemapUrls(
        this.http,
        root,
        (u) => this.filterSitemapUrl(u),
        maxUrls - all.length,
      )
      all.push(...urls)
      if (all.length >= maxUrls) break
    }
    return [...new Set(all)]
  }

  toRawImport(url: string, payload: Record<string, unknown> = {}): RawImportRecord {
    return {
      source: this.source,
      external_id: this.externalIdFromUrl(url),
      source_url: url,
      payload: { ...payload, harvested_at: new Date().toISOString() },
      full_name: (payload.full_name as string) ?? null,
      specialty_raw: (payload.specialty as string) ?? null,
      city_raw: (payload.city as string) ?? null,
      pmdc_number: (payload.pmdc_number as string) ?? null,
    }
  }

  async upsertRawImports(records: RawImportRecord[]): Promise<{ inserted: number; errors: number }> {
    let inserted = 0
    let errors = 0

    const deduped = dedupeRawImports(records)

    for (const batch of chunk(deduped, 100)) {
      const { error } = await this.supabase.from('doctor_import_raw').upsert(
        batch.map((r) => ({
          source: r.source,
          external_id: r.external_id,
          source_url: r.source_url,
          payload: r.payload,
          full_name: r.full_name,
          specialty_raw: r.specialty_raw,
          city_raw: r.city_raw,
          pmdc_number: r.pmdc_number,
          review_status: 'pending',
          fetch_status: 'sitemap_only',
        })),
        { onConflict: 'source,external_id', ignoreDuplicates: false },
      )
      if (error) {
        console.warn(`[${this.source}] batch error:`, error.message)
        errors += batch.length
      } else {
        inserted += batch.length
      }
    }

    return { inserted, errors }
  }

  async fetchProfile(url: string): Promise<ProfileFetchResult> {
    const external_id = this.externalIdFromUrl(url)
    const { ok, status, text } = await this.http.fetchText(url)
    if (!ok) {
      const fallback = this.parseProfileFromUrl(url)
      return {
        external_id,
        source_url: url,
        normalized: fallback,
        error: `HTTP ${status}`,
      }
    }

    let normalized = this.parseProfileHtml(url, text)
    if (!normalized) normalized = this.parseProfileFromUrl(url)

    return {
      external_id,
      source_url: url,
      normalized,
      raw_html_length: text.length,
      error: normalized ? undefined : 'parse_failed',
    }
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function dedupeRawImports(records: RawImportRecord[]): RawImportRecord[] {
  const byKey = new Map<string, RawImportRecord>()
  for (const r of records) {
    byKey.set(`${r.source}:${r.external_id}`, r)
  }
  return [...byKey.values()]
}
