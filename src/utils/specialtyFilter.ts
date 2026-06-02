import type { Doctor } from '@/lib/database.types'

/** Filter slug (UI) → DB specialty_slug values and specialty text keywords. */
const SPECIALTY_FILTER_GROUPS: Record<string, { slugs: string[]; keywords: string[] }> = {
  general: {
    slugs: ['general', 'general_physician', 'general_practitioner', 'family_medicine'],
    keywords: ['general physician', 'general practitioner', 'family medicine', 'gp'],
  },
  cardiology: {
    slugs: ['cardiology', 'cardiologist', 'cardiac_surgeon'],
    keywords: ['cardiolog', 'heart specialist', 'cardiac'],
  },
  dermatology: {
    slugs: ['dermatology', 'dermatologist'],
    keywords: ['dermatolog', 'skin specialist'],
  },
  orthopedics: {
    slugs: ['orthopedics', 'orthopedic', 'orthopaedic', 'orthopedic_surgeon', 'orthopaedic_surgeon'],
    keywords: ['orthop'],
  },
  gynecology: {
    slugs: ['gynecology', 'gynecologist', 'gynaecologist', 'gynaecology'],
    keywords: ['gynecolog', 'gynaecolog', 'obstetric'],
  },
  pediatrics: {
    slugs: ['pediatrics', 'pediatrician', 'paediatrician', 'pediatric_surgeon', 'paediatric_surgeon'],
    keywords: ['pediatric', 'paediatric', 'child specialist'],
  },
  neurology: {
    slugs: ['neurology', 'neurologist', 'neurosurgeon', 'neuro_surgeon'],
    keywords: ['neurolog', 'neurosur'],
  },
  ent: {
    slugs: ['ent', 'ent_surgeon', 'otolaryngologist', 'otolaryngology'],
    keywords: ['ent ', 'ent,', 'ear nose', 'otolaryng'],
  },
  ophthalmology: {
    slugs: ['ophthalmology', 'ophthalmologist'],
    keywords: ['ophthalmolog', 'eye specialist'],
  },
  psychiatry: {
    slugs: ['psychiatry', 'psychiatrist'],
    keywords: ['psychiatr', 'mental health'],
  },
  urology: {
    slugs: ['urology', 'urologist'],
    keywords: ['urolog'],
  },
  gastroenterology: {
    slugs: ['gastroenterology', 'gastroenterologist'],
    keywords: ['gastroenterolog', 'gi specialist'],
  },
  endocrinology: {
    slugs: ['endocrinology', 'endocrinologist'],
    keywords: ['endocrinolog', 'diabetolog'],
  },
  pulmonology: {
    slugs: ['pulmonology', 'pulmonologist', 'chest_specialist'],
    keywords: ['pulmonolog', 'lung specialist', 'respiratory'],
  },
}

export function getSpecialtyFilterGroup(filterSlug: string) {
  return (
    SPECIALTY_FILTER_GROUPS[filterSlug] ?? {
      slugs: [filterSlug, filterSlug.replace(/-/g, '_')],
      keywords: [filterSlug.replace(/_/g, ' '), filterSlug.replace(/-/g, ' ')],
    }
  )
}

export function doctorMatchesSpecialtyFilter(
  doctor: Pick<Doctor, 'specialty' | 'specialty_slug'>,
  filterSlug: string | undefined
): boolean {
  if (!filterSlug) return true

  const slug = (doctor.specialty_slug ?? '').toLowerCase()
  const label = (doctor.specialty ?? '').toLowerCase()
  const { slugs, keywords } = getSpecialtyFilterGroup(filterSlug)

  if (slugs.includes(slug)) return true
  if (slug === filterSlug || slug.startsWith(`${filterSlug}_`) || slug.includes(filterSlug)) {
    return true
  }

  return keywords.some((kw) => label.includes(kw))
}

/** Supabase `.or()` clause for city queries with specialty filter. */
export function buildSpecialtyOrFilter(filterSlug: string): string {
  const { slugs, keywords } = getSpecialtyFilterGroup(filterSlug)
  const parts = new Set<string>()
  for (const s of slugs) {
    parts.add(`specialty_slug.eq.${s}`)
  }
  for (const kw of keywords) {
    const safe = kw.replace(/,/g, '')
    parts.add(`specialty.ilike.%${safe}%`)
  }
  parts.add(`specialty_slug.ilike.%${filterSlug}%`)
  return [...parts].join(',')
}
