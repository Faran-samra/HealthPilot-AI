import {
  normalizeCitySlug,
  normalizeDoctorName,
  normalizeSpecialty,
  parseFee,
  type NormalizedDoctorRow,
} from '../../lib/normalize.ts'
import { BaseSourceConnector } from '../base-connector.ts'
import type { ConnectorConfig } from '../../lib/types.ts'

export class OladocConnector extends BaseSourceConnector {
  get source() {
    return 'oladoc' as const
  }

  constructor(supabase: import('@supabase/supabase-js').SupabaseClient, config?: Partial<ConnectorConfig>) {
    super(supabase, {
      source: 'oladoc',
      userAgent: 'HealthPilot-DirectoryBot/1.0 (+https://healthpilot.ai; oladoc-ingest)',
      requestsPerSecond: 1,
      maxRetries: 2,
      ...config,
    })
  }

  getSitemapRoots(): string[] {
    return ['https://oladoc.com/sitemaps/sitemap_doctors']
  }

  isProfileUrl(url: string): boolean {
    try {
      const u = new URL(url)
      if (!u.hostname.includes('oladoc.com')) return false
      return /\/(pakistan\/)?[a-z-]+\/[a-z0-9-]+$/i.test(u.pathname) && u.pathname.includes('/')
    } catch {
      return false
    }
  }

  externalIdFromUrl(url: string): string {
    const path = new URL(url).pathname.replace(/\/+$/, '')
    return path
  }

  parseProfileFromUrl(url: string): NormalizedDoctorRow | null {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    const slug = parts[parts.length - 1] ?? ''
    const city = parts.find((p) =>
      ['lahore', 'karachi', 'islamabad', 'rawalpindi', 'faisalabad', 'multan', 'peshawar', 'quetta'].includes(p),
    )
    const specialtyPart = parts.find((p) => p.endsWith('ologist') || p.endsWith('iatrist'))
    const { slug: specialty_slug, label: specialty } = normalizeSpecialty(specialtyPart ?? 'general')
    const name = slug.replace(/-/g, ' ')

    return {
      full_name: normalizeDoctorName(name),
      specialty,
      specialty_slug,
      city: city ?? 'lahore',
      city_slug: normalizeCitySlug(city),
      source: 'oladoc',
      source_url: url,
      verification_status: 'unverified',
      is_verified: false,
    }
  }

  parseProfileHtml(url: string, html: string): NormalizedDoctorRow | null {
    const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1]
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd) as { name?: string; medicalSpecialty?: string }
        if (data.name) {
          const { slug, label } = normalizeSpecialty(data.medicalSpecialty)
          return {
            full_name: normalizeDoctorName(data.name),
            specialty: label,
            specialty_slug: slug,
            city: 'lahore',
            city_slug: 'lahore',
            source: 'oladoc',
            source_url: url,
            verification_status: 'unverified',
            is_verified: false,
          }
        }
      } catch {
        /* fall through */
      }
    }

    const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]
    const fee = html.match(/(?:Fee|Charges)[^₨RsPK]*([\d,]+)/i)?.[1]
    if (!h1) return this.parseProfileFromUrl(url)

    const { slug, label } = normalizeSpecialty(
      html.match(/specialt(?:y|ies)[^>]*>([^<]+)/i)?.[1],
    )
    const city = html.match(/(Lahore|Karachi|Islamabad|Rawalpindi|Faisalabad|Multan|Peshawar)/i)?.[1]

    return {
      full_name: normalizeDoctorName(h1),
      specialty: label,
      specialty_slug: slug,
      city: city ?? 'lahore',
      city_slug: normalizeCitySlug(city),
      consultation_fee: parseFee(fee),
      source: 'oladoc',
      source_url: url,
      verification_status: 'unverified',
      is_verified: false,
      languages: ['Urdu', 'English'],
    }
  }
}
