import {
  normalizeCitySlug,
  normalizeDoctorName,
  normalizeSpecialty,
  type NormalizedDoctorRow,
} from '../../lib/normalize.ts'
import { cleanDisplayText, isGarbageDisplayText, isGarbageDoctorName } from '../../lib/sanitize.ts'
import {
  extractMarhamConsultationFee,
  extractFirstH1,
  extractJsonField,
  extractMarhamPractice,
  extractMarhamProfileDetails,
  extractMarhamWhatsApp,
  extractMetaContent,
  parseMarhamProfileTitle,
  stripNonContentHtml,
} from '../../lib/html-extract.ts'
import { resolveDoctorMapPosition } from '../../../../src/utils/doctorLocationResolve.ts'
import { extractGenderFromProfileHtml, inferGenderFromName } from '../../../../src/utils/doctorGender.ts'
import { cleanWorkplaceName } from '../../../../src/utils/doctorWorkplace.ts'
import {
  parseCityFromMarhamSlug,
  resolveMarhamDoctorCity,
} from '../../../../src/utils/pakistanCityExtract.ts'
import { buildMarhamAvailability } from '../../lib/marhamAvailability.ts'
import { MARHAM_LISTING_CITY_SLUGS } from '../../lib/marham-cities.ts'
import { parseSitemapXml } from '../../lib/http-client.ts'
import {
  isMarhamDoctorProfileUrl,
  nameFromMarhamProfileSlug,
  parseMarhamProfilePath,
  specialtyHintFromPathSegment,
} from '../../lib/marhamUrlParse.ts'
import { BaseSourceConnector } from '../base-connector.ts'
import type { ConnectorConfig } from '../../lib/types.ts'

function pickWorkplaceName(candidates: (string | null | undefined)[]): string | null {
  for (const raw of candidates) {
    const cleaned = cleanWorkplaceName(cleanDisplayText(raw, 120))
    if (cleaned) return cleaned
  }
  return null
}

export class MarhamConnector extends BaseSourceConnector {
  get source() {
    return 'marham' as const
  }

  constructor(supabase: import('@supabase/supabase-js').SupabaseClient, config?: Partial<ConnectorConfig>) {
    super(supabase, {
      source: 'marham',
      userAgent: 'HealthPilot-DirectoryBot/1.0 (+https://healthpilot.ai; marham-ingest)',
      requestsPerSecond: 1,
      maxRetries: 2,
      ...config,
    })
  }

  getSitemapRoots(): string[] {
    return [
      'https://www.marham.pk/sitemap_doctors.xml',
      'https://www.marham.pk/sitemap_doctors_1.xml',
      'https://www.marham.pk/sitemap_doctors_2.xml',
      'https://www.marham.pk/sitemap_doctors_3.xml',
      'https://www.marham.pk/sitemap_doctors_4.xml',
    ]
  }

  /** Discover extra doctor sitemap shards from Marham sitemap index. */
  async discoverDoctorSitemapRoots(): Promise<string[]> {
    const found = new Set<string>(this.getSitemapRoots())
    const indexCandidates = [
      'https://www.marham.pk/sitemap.xml',
      'https://www.marham.pk/sitemap_index.xml',
    ]

    for (const indexUrl of indexCandidates) {
      const { ok, text } = await this.http.fetchText(indexUrl)
      if (!ok) continue
      const { sitemapIndexes } = parseSitemapXml(text)
      for (const loc of sitemapIndexes) {
        if (/sitemap_doctors/i.test(loc)) found.add(loc)
      }
    }

    return [...found]
  }

  /** Common specialties — listing pages list dozens of doctors per city (incl. small towns). */
  static readonly HARVEST_SPECIALTY_SLUGS = [
    'general-physician',
    'gynecologist',
    'dermatologist',
    'pediatrician',
    'dentist',
    'cardiologist',
    'ent-specialist',
    'orthopedic-surgeon',
    'urologist',
    'psychiatrist',
    'general-surgeon',
    'pulmonologist',
    'neurologist',
    'nutritionist',
    'eye-specialist',
  ] as const

  listingSeeds(): string[] {
    const seeds = new Set<string>()
    for (const city of MARHAM_LISTING_CITY_SLUGS) {
      seeds.add(`https://www.marham.pk/doctors/${city}`)
      for (const specialty of MarhamConnector.HARVEST_SPECIALTY_SLUGS) {
        seeds.add(`https://www.marham.pk/doctors/${city}/${specialty}`)
      }
    }
    return [...seeds]
  }

  extractProfileLinks(html: string): string[] {
    const links = new Set<string>()
    const patterns = [
      /href="(https:\/\/www\.marham\.pk\/doctors\/[^"?#]+)"/gi,
      /href="(\/doctors\/[^"?#]+)"/gi,
    ]
    for (const re of patterns) {
      let m: RegExpExecArray | null
      while ((m = re.exec(html)) !== null) {
        let href = m[1].trim()
        if (href.startsWith('/')) href = `https://www.marham.pk${href}`
        if (isMarhamDoctorProfileUrl(href)) links.add(href.split('?')[0])
      }
    }
    return [...links]
  }

  /** City directory pages — covers Punjab/smaller cities not always in early sitemap pages. */
  async harvestFromCityListings(maxProfiles = 8000): Promise<string[]> {
    const profiles: string[] = []
    const seeds = this.listingSeeds()

    for (const seed of seeds) {
      if (profiles.length >= maxProfiles) break
      const { ok, text } = await this.http.fetchText(seed)
      if (!ok) continue
      for (const url of this.extractProfileLinks(text)) {
        profiles.push(url)
        if (profiles.length >= maxProfiles) break
      }
    }

    return [...new Set(profiles)]
  }

  async harvestAllProfileUrls(maxUrls: number, options?: { cityListings?: boolean }): Promise<string[]> {
    const useCityListings = options?.cityListings !== false
    const sitemapBudget = useCityListings ? Math.floor(maxUrls * 0.7) : maxUrls
    const listingBudget = maxUrls - sitemapBudget

    const roots = await this.discoverDoctorSitemapRoots()
    const fromSitemap: string[] = []
    const { fetchAllSitemapUrls } = await import('../../lib/http-client.ts')

    for (const root of roots) {
      if (fromSitemap.length >= sitemapBudget) break
      const urls = await fetchAllSitemapUrls(
        this.http,
        root,
        (u) => this.filterSitemapUrl(u),
        sitemapBudget - fromSitemap.length,
      )
      fromSitemap.push(...urls)
    }

    let fromListings: string[] = []
    if (useCityListings && listingBudget > 0) {
      fromListings = await this.harvestFromCityListings(listingBudget)
    }

    return [...new Set([...fromSitemap, ...fromListings])].slice(0, maxUrls)
  }

  override async harvestSitemapUrls(maxUrls = 10_000): Promise<string[]> {
    return this.harvestAllProfileUrls(maxUrls)
  }

  isProfileUrl(url: string): boolean {
    return isMarhamDoctorProfileUrl(url)
  }

  externalIdFromUrl(url: string): string {
    const path = new URL(url).pathname.replace(/\/+$/, '')
    return path.split('/').filter(Boolean).pop() ?? path
  }

  /** Path: /doctors/{city}/{specialty}/{slug} — legacy: dr-name-specialty-city */
  parseSlugMeta(url: string): { specialtyHint: string; cityHint: string; nameHint: string } {
    const path = parseMarhamProfilePath(url)
    if (path) {
      return {
        cityHint: path.citySlug,
        specialtyHint: specialtyHintFromPathSegment(path.specialtySlug),
        nameHint: nameFromMarhamProfileSlug(path.profileSlug),
      }
    }

    const slug = this.externalIdFromUrl(url)
    const parts = slug.split('-').filter(Boolean)
    const citySlug = parseCityFromMarhamSlug(slug)
    const cityParts = citySlug ? citySlug.split('-').length : 1
    const specialtyHint = parts.slice(-(cityParts + 1), -cityParts).join(' ') || 'general'
    const cityHint = citySlug ?? parts[parts.length - 1] ?? 'lahore'
    const nameHint = parts.slice(0, -(cityParts + 1)).join(' ')
    return { specialtyHint, cityHint, nameHint }
  }

  parseProfileFromUrl(url: string): NormalizedDoctorRow | null {
    const { specialtyHint, cityHint, nameHint } = this.parseSlugMeta(url)
    const { slug: specialty_slug, label: specialty } = normalizeSpecialty(specialtyHint)
    const full_name = normalizeDoctorName(nameHint || specialtyHint)
    if (isGarbageDoctorName(full_name)) return null

    return {
      full_name,
      specialty,
      specialty_slug,
      city: cityHint,
      city_slug: normalizeCitySlug(cityHint),
      source: 'marham',
      source_url: url,
      verification_status: 'unverified',
      is_verified: false,
      languages: ['Urdu', 'English'],
    }
  }

  extractSpecialtyFromHtml(html: string, url: string): { slug: string; label: string } {
    const content = stripNonContentHtml(html)
    const fromUrl = this.parseSlugMeta(url)

    const og = parseMarhamProfileTitle(extractMetaContent(html, 'og:title'))
    if (og.specialty && !isGarbageDisplayText(og.specialty)) {
      return normalizeSpecialty(og.specialty)
    }

    const candidates = [
      extractJsonField(html, 'speciality'),
      extractJsonField(html, 'speciality_name'),
      extractJsonField(html, 'specialty'),
      extractJsonField(html, 'specialty_name'),
      content.match(
        /<a[^>]+href=["'][^"']*\/doctors\/[^"']*\/([^/"']+)["'][^>]*>/i,
      )?.[1]?.replace(/-/g, ' '),
      fromUrl.specialtyHint,
    ]

    for (const raw of candidates) {
      const cleaned = cleanDisplayText(raw, 60)
      if (!cleaned || isGarbageDisplayText(cleaned)) continue
      const fromTitle = cleaned.match(/^([A-Za-z\s]+?)\s+in\s+/i)?.[1]?.trim()
      const specialtyRaw = fromTitle ?? cleaned
      if (!isGarbageDisplayText(specialtyRaw)) {
        return normalizeSpecialty(specialtyRaw)
      }
    }

    return normalizeSpecialty(fromUrl.specialtyHint)
  }

  parseProfileHtml(url: string, html: string): NormalizedDoctorRow | null {
    const content = stripNonContentHtml(html)
    const fromUrl = this.parseProfileFromUrl(url)
    if (!fromUrl) return null

    const ogTitle = extractMetaContent(html, 'og:title')
    const ogFields = parseMarhamProfileTitle(ogTitle)
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
    const h1 = extractFirstH1(content)
    const nameRaw =
      cleanDisplayText(ogFields.name, 80) ??
      cleanDisplayText(h1, 80) ??
      cleanDisplayText(title?.split('|')[0], 80)
    let name = nameRaw && !isGarbageDisplayText(nameRaw) ? nameRaw : fromUrl.full_name
    if (isGarbageDoctorName(name)) {
      const path = parseMarhamProfilePath(url)
      if (path) {
        const fromSlug = nameFromMarhamProfileSlug(path.profileSlug)
        if (fromSlug) name = normalizeDoctorName(fromSlug)
      }
    }
    if (isGarbageDoctorName(name)) return null

    const pmdc = html.match(/PMDC[^0-9]*(\d{4,}[-/]?\d*)/i)?.[1]
    const { slug, label } = this.extractSpecialtyFromHtml(html, url)

    const practice = extractMarhamPractice(html)
    const profileSlug = this.externalIdFromUrl(url)
    const pathCity = parseMarhamProfilePath(url)?.citySlug
    const { city, city_slug, province } = resolveMarhamDoctorCity({
      profileSlug,
      urlCitySlug: pathCity,
      jsonCity: extractJsonField(html, 'city') ?? extractJsonField(html, 'city_name'),
      areaLine: practice.address ?? practice.area,
    })
    const hospital = pickWorkplaceName([
      practice.hospital_name,
      ogFields.hospital,
      extractJsonField(html, 'hospital_name'),
      extractJsonField(html, 'practice_name'),
    ])

    const full_name = normalizeDoctorName(name)
    const gender =
      extractGenderFromProfileHtml(html) ?? inferGenderFromName(full_name) ?? undefined

    const profileDetails = extractMarhamProfileDetails(html, full_name)
    const marhamWa = profileDetails.marham_whatsapp ?? extractMarhamWhatsApp(html)
    const practiceTimings = profileDetails.practice_timings ?? []
    const availability = buildMarhamAvailability(profileDetails, practiceTimings)

    const row: NormalizedDoctorRow = {
      ...fromUrl,
      full_name,
      specialty: label,
      specialty_slug: slug,
      city,
      city_slug,
      province,
      hospital_name: hospital,
      area: practice.area ? cleanDisplayText(practice.area, 80) : null,
      address: practice.address ? cleanDisplayText(practice.address, 160) : null,
      qualification: practice.qualification
        ? cleanDisplayText(practice.qualification, 120)
        : null,
      consultation_fee: extractMarhamConsultationFee(html),
      pmdc_number: pmdc ?? null,
      gender,
      phone: null,
      whatsapp: marhamWa ?? null,
      available_days: availability.available_days ?? undefined,
      available_times: availability.available_times ?? undefined,
      profile_details: availability.profile_details,
      source: 'marham',
      source_url: url,
      verification_status: 'unverified',
      is_verified: false,
      languages: ['Urdu', 'English'],
    }

    const pos = resolveDoctorMapPosition({
      latitude: null,
      longitude: null,
      city_slug: row.city_slug,
      city: row.city,
      area: row.area,
      address: row.address,
      hospital_name: row.hospital_name,
      clinic_name: row.clinic_name,
    })
    row.latitude = pos.lat
    row.longitude = pos.lng

    return row
  }
}
