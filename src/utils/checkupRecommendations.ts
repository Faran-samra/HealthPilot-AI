export interface CheckupRecommendation {
  id: string
  titleKey: string
  descKey: string
  specialtySlug?: string
}

export function getRecommendedCheckups(
  age?: number | null,
  gender?: string | null
): CheckupRecommendation[] {
  const recs: CheckupRecommendation[] = []

  if (!age) {
    recs.push({
      id: 'general',
      titleKey: 'dashboard.checkupGeneralTitle',
      descKey: 'dashboard.checkupGeneralDesc',
      specialtySlug: 'general',
    })
    return recs
  }

  if (age >= 30) {
    recs.push({
      id: 'diabetes',
      titleKey: 'dashboard.checkupDiabetesTitle',
      descKey: 'dashboard.checkupDiabetesDesc',
      specialtySlug: 'endocrinology',
    })
  }

  if (age >= 40) {
    recs.push({
      id: 'eye',
      titleKey: 'dashboard.checkupEyeTitle',
      descKey: 'dashboard.checkupEyeDesc',
      specialtySlug: 'ophthalmology',
    })
  }

  if (gender === 'female' && age >= 21) {
    recs.push({
      id: 'gynecology',
      titleKey: 'dashboard.checkupGynTitle',
      descKey: 'dashboard.checkupGynDesc',
      specialtySlug: 'gynecology',
    })
  }

  if (age >= 45) {
    recs.push({
      id: 'cardiac',
      titleKey: 'dashboard.checkupCardiacTitle',
      descKey: 'dashboard.checkupCardiacDesc',
      specialtySlug: 'cardiology',
    })
  }

  if (recs.length === 0) {
    recs.push({
      id: 'general',
      titleKey: 'dashboard.checkupGeneralTitle',
      descKey: 'dashboard.checkupGeneralDesc',
      specialtySlug: 'general',
    })
  }

  return recs.slice(0, 4)
}
