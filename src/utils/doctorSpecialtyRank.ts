import type { Doctor } from '@/lib/database.types'
import { doctorMatchesSpecialtyFilter } from '@/utils/specialtyFilter'

function specialtyBlob(d: Pick<Doctor, 'specialty' | 'specialty_slug'>): string {
  return `${d.specialty ?? ''} ${d.specialty_slug ?? ''}`.toLowerCase()
}

/** Prefer the best-matching clinicians for the recommended specialty slug. */
export function rankDoctorsForSymptomSpecialty<T extends Pick<Doctor, 'specialty' | 'specialty_slug'>>(
  doctors: T[],
  specialtySlug: string | undefined
): T[] {
  if (!specialtySlug) return doctors

  const score = (d: T): number => {
    const blob = specialtyBlob(d)

    if (specialtySlug === 'neurology') {
      if (/\bneurologist\b/.test(blob) && !/surgeon/.test(blob)) return 0
      if (/neurology/.test(blob) && !/surgeon/.test(blob)) return 1
      if (/neurolog/.test(blob) && !/surgeon/.test(blob)) return 2
      if (/neuro.*surgeon|neurosurgeon/.test(blob)) return 4
      return 3
    }

    if (specialtySlug === 'ent') {
      if (/dent/.test(blob)) return 99
      if (/\bent\b|otolaryng|ear nose|throat specialist/.test(blob)) return 0
      if (/general physician|general practitioner/.test(blob)) return 4
      return 8
    }

    if (specialtySlug === 'cardiology') {
      if (/psychiatr|neurolog|dent/.test(blob)) return 99
      if (/cardiolog|heart specialist|cardiac/.test(blob)) return 0
      if (/general physician|general practitioner/.test(blob)) return 3
      return 8
    }

    if (specialtySlug === 'psychiatry') {
      if (/neurolog(?!.*psych)/.test(blob) && !/psychiatr/.test(blob)) return 8
      if (/psychiatr/.test(blob)) return 0
      return 5
    }

    return doctorMatchesSpecialtyFilter(d, specialtySlug) ? 0 : 5
  }

  return [...doctors]
    .filter((d) => {
      const blob = specialtyBlob(d)
      if (specialtySlug === 'ent' && /dent/.test(blob)) return false
      if (specialtySlug === 'cardiology' && /psychiatr|neurolog|dent/.test(blob)) return false
      return true
    })
    .sort((a, b) => score(a) - score(b))
}
