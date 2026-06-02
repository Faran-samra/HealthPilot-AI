import {
  normalizeCitySlug,
  normalizeDoctorName,
  normalizeSpecialty,
  type NormalizedDoctorRow,
} from '../../lib/normalize.ts'
import { BaseSourceConnector } from '../base-connector.ts'
import type { ConnectorConfig } from '../../lib/types.ts'

const CITIES = [
  'lahore', 'karachi', 'islamabad', 'rawalpindi', 'faisalabad', 'multan',
  'peshawar', 'quetta', 'hyderabad', 'sialkot', 'gujranwala',
]

export class HamariWebConnector extends BaseSourceConnector {
  get source() {
    return 'hamariweb' as const
  }

  constructor(supabase: import('@supabase/supabase-js').SupabaseClient, config?: Partial<ConnectorConfig>) {
    super(supabase, {
      source: 'hamariweb',
      userAgent: 'HealthPilot-DirectoryBot/1.0 (+https://healthpilot.ai; hamariweb-ingest)',
      requestsPerSecond: 0.5,
      maxRetries: 2,
      ...config,
    })
  }

  getSitemapRoots(): string[] {
    return ['https://health.hamariweb.com/sitemap.xml']
  }

  isProfileUrl(url: string): boolean {
    try {
      const u = new URL(url)
      if (!u.hostname.includes('hamariweb.com')) return false
      return /_doc\d+/i.test(u.pathname) || /\/doctors?\//i.test(u.pathname)
    } catch {
      return false
    }
  }

  externalIdFromUrl(url: string): string {
    const m = url.match(/_doc(\d+)/i)
    if (m) return `doc${m[1]}`
    return new URL(url).pathname.replace(/\/+$/, '')
  }

  /** HamariWeb may not expose a rich sitemap — seed listing pages per city. */
  async harvestListingSeeds(): Promise<string[]> {
    const seeds: string[] = ['https://health.hamariweb.com/doctors']
    for (const city of CITIES) {
      seeds.push(`https://health.hamariweb.com/${city}/doctors`)
    }
    return seeds
  }

  parseProfileFromUrl(url: string): NormalizedDoctorRow | null {
    const path = new URL(url).pathname
    const city = CITIES.find((c) => path.includes(`/${c}/`)) ?? 'lahore'
    const slug = path.split('/').filter(Boolean).pop() ?? ''
    const name = slug.replace(/_doc\d+/i, '').replace(/-/g, ' ')
    const specMatch = path.match(/\/doctors\/([^/]+)/i)
    const { slug: specialty_slug, label: specialty } = normalizeSpecialty(specMatch?.[1])

    return {
      full_name: normalizeDoctorName(name),
      specialty,
      specialty_slug,
      city,
      city_slug: normalizeCitySlug(city),
      source: 'hamariweb',
      source_url: url,
      verification_status: 'unverified',
      is_verified: false,
    }
  }

  parseProfileHtml(url: string, html: string): NormalizedDoctorRow | null {
    const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]
    const phone = html.match(/(?:Phone|Contact)[^0-9+]*([+0-9][\d\s-]{9,14})/i)?.[1]
    const fee = html.match(/(?:Fee|Charges)[^0-9]*([\d,]+)/i)?.[1]
    if (!h1) return this.parseProfileFromUrl(url)

    const city = CITIES.find((c) => html.toLowerCase().includes(c)) ?? 'lahore'
    const { slug, label } = normalizeSpecialty(
      html.match(/Specialit(?:y|ies)[^>]*>([^<]+)/i)?.[1],
    )

    return {
      full_name: normalizeDoctorName(h1),
      specialty: label,
      specialty_slug: slug,
      city,
      city_slug: normalizeCitySlug(city),
      phone: phone?.replace(/\s/g, '') ?? null,
      consultation_fee: fee ? parseInt(fee.replace(/,/g, ''), 10) : null,
      source: 'hamariweb',
      source_url: url,
      verification_status: 'unverified',
      is_verified: false,
      languages: ['Urdu', 'English'],
    }
  }

  /** Extract profile links from a city listing HTML page. */
  extractProfileLinks(html: string, baseUrl: string): string[] {
    const links = new Set<string>()
    const re = /href="(\/[^"]*_doc\d+[^"]*|https:\/\/health\.hamariweb\.com[^"]*_doc\d+[^"]*)"/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      let href = m[1]
      if (href.startsWith('/')) href = `https://health.hamariweb.com${href}`
      if (this.isProfileUrl(href)) links.add(href.split('?')[0])
    }
    return [...links]
  }

  async harvestFromListings(maxProfiles = 5000): Promise<string[]> {
    const seeds = await this.harvestListingSeeds()
    const profiles: string[] = []

    for (const seed of seeds) {
      if (profiles.length >= maxProfiles) break
      const { ok, text } = await this.http.fetchText(seed)
      if (!ok) continue
      const found = this.extractProfileLinks(text, seed)
      for (const u of found) {
        profiles.push(u)
        if (profiles.length >= maxProfiles) break
      }
    }

    return [...new Set(profiles)]
  }
}
