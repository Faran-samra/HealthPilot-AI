/** Map OSM tags and facility names to HealthPilot specialty slugs. */
const OSM_SPECIALTY_MAP: Record<string, string> = {
  general: 'general',
  physician: 'general',
  gp: 'general',
  cardiology: 'cardiology',
  cardiac: 'cardiology',
  heart: 'cardiology',
  dermatology: 'dermatology',
  skin: 'dermatology',
  orthopaedics: 'orthopedics',
  orthopedics: 'orthopedics',
  orthopaedic: 'orthopedics',
  gynaecology: 'gynecology',
  gynecology: 'gynecology',
  obstetrics: 'gynecology',
  paediatrics: 'pediatrics',
  pediatrics: 'pediatrics',
  pediatric: 'pediatrics',
  neurology: 'neurology',
  neuro: 'neurology',
  otolaryngology: 'ent',
  ent: 'ent',
  ophthalmology: 'ophthalmology',
  eye: 'ophthalmology',
  psychiatry: 'psychiatry',
  psychiatric: 'psychiatry',
  mental: 'psychiatry',
  urology: 'urology',
  gastroenterology: 'gastroenterology',
  gastro: 'gastroenterology',
  endocrinology: 'endocrinology',
  diabetes: 'endocrinology',
  pulmonology: 'pulmonology',
  pulmonary: 'pulmonology',
  respiratory: 'pulmonology',
}

const NAME_KEYWORDS: Array<{ pattern: RegExp; slug: string }> = [
  { pattern: /cardio|heart/i, slug: 'cardiology' },
  { pattern: /derma|skin/i, slug: 'dermatology' },
  { pattern: /ortho|bone|joint/i, slug: 'orthopedics' },
  { pattern: /gynae|gyno|women|maternity|obs/i, slug: 'gynecology' },
  { pattern: /pediat|child|children|baby/i, slug: 'pediatrics' },
  { pattern: /neuro|brain/i, slug: 'neurology' },
  { pattern: /\bent\b|ear nose|throat/i, slug: 'ent' },
  { pattern: /eye|ophthal|vision/i, slug: 'ophthalmology' },
  { pattern: /psych|mental/i, slug: 'psychiatry' },
  { pattern: /urol|kidney/i, slug: 'urology' },
  { pattern: /gastro|stomach/i, slug: 'gastroenterology' },
  { pattern: /diabet|endocrin|thyroid/i, slug: 'endocrinology' },
  { pattern: /pulmon|lung|chest|respir/i, slug: 'pulmonology' },
]

export function slugToLabel(slug: string): string {
  const labels: Record<string, string> = {
    general: 'General Physician',
    cardiology: 'Cardiologist',
    dermatology: 'Dermatologist',
    orthopedics: 'Orthopedic',
    gynecology: 'Gynecologist',
    pediatrics: 'Pediatrician',
    neurology: 'Neurologist',
    ent: 'ENT Specialist',
    ophthalmology: 'Ophthalmologist',
    psychiatry: 'Psychiatrist',
    urology: 'Urologist',
    gastroenterology: 'Gastroenterologist',
    endocrinology: 'Endocrinologist',
    pulmonology: 'Pulmonologist',
  }
  return labels[slug] ?? 'Healthcare Facility'
}

export function inferSpecialtyFromOsm(
  name: string,
  tags: Record<string, string>
): { slug: string | null; label: string } {
  const rawSpecialty =
    tags['healthcare:speciality'] ??
    tags['healthcare:specialty'] ??
    tags.speciality ??
    tags.specialty ??
    ''

  if (rawSpecialty) {
    const normalized = rawSpecialty.toLowerCase().split(/[;,|]/)[0].trim()
    const slug = OSM_SPECIALTY_MAP[normalized] ?? null
    if (slug) return { slug, label: slugToLabel(slug) }
  }

  const amenity = tags.amenity ?? ''
  const healthcare = tags.healthcare ?? ''

  if (healthcare === 'doctor' || amenity === 'doctors') {
    for (const { pattern, slug } of NAME_KEYWORDS) {
      if (pattern.test(name)) return { slug, label: slugToLabel(slug) }
    }
    return { slug: 'general', label: slugToLabel('general') }
  }

  if (healthcare === 'hospital' || amenity === 'hospital') {
    return { slug: null, label: 'Hospital' }
  }

  if (healthcare === 'clinic' || amenity === 'clinic') {
    return { slug: 'general', label: 'Clinic / General Care' }
  }

  for (const { pattern, slug } of NAME_KEYWORDS) {
    if (pattern.test(name)) return { slug, label: slugToLabel(slug) }
  }

  return { slug: null, label: 'Healthcare Facility' }
}

export function specialtyMatchScore(
  resultSlug: string | null,
  filterSlug: string | null
): number {
  if (!filterSlug) return 0.5
  if (!resultSlug) return 0.15
  if (resultSlug === filterSlug) return 1
  if (resultSlug === 'general' && filterSlug !== 'general') return 0.35
  return 0
}
