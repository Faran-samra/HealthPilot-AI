import { matchesGenderFilter } from '@/utils/doctorGender'
import { doctorMatchesSpecialtyFilter } from '@/utils/specialtyFilter'
import type { DirectoryDoctor } from '@/types/doctorDirectory'

export interface DirectoryListFilters {
  specialty?: string
  name?: string
  area?: string
  hospital?: string
  maxFee?: number
  minFee?: number
  femaleOnly?: boolean
  maleOnly?: boolean
  language?: string
}

/** Client-side filter for instant UI while a refined server fetch runs. */
export function filterDirectoryDoctors(
  doctors: DirectoryDoctor[],
  filters: DirectoryListFilters
): DirectoryDoctor[] {
  let list = doctors

  if (filters.specialty && filters.specialty !== 'all') {
    list = list.filter((d) =>
      doctorMatchesSpecialtyFilter(
        { specialty: d.specialty, specialty_slug: d.specialty_slug },
        filters.specialty
      )
    )
  }

  const q = filters.name?.trim().toLowerCase()
  if (q) {
    list = list.filter((d) => d.full_name.toLowerCase().includes(q))
  }

  const area = filters.area?.trim().toLowerCase()
  if (area) {
    list = list.filter((d) => d.area?.toLowerCase().includes(area))
  }

  const hospital = filters.hospital?.trim().toLowerCase()
  if (hospital) {
    list = list.filter(
      (d) =>
        d.hospital_name?.toLowerCase().includes(hospital) ||
        d.clinic_name?.toLowerCase().includes(hospital)
    )
  }

  if (filters.maxFee != null) {
    list = list.filter((d) => (d.consultation_fee ?? 0) <= filters.maxFee!)
  }
  if (filters.minFee != null) {
    list = list.filter((d) => (d.consultation_fee ?? 0) >= filters.minFee!)
  }
  if (filters.femaleOnly) {
    list = list.filter((d) => matchesGenderFilter(d, 'female'))
  }
  if (filters.maleOnly) {
    list = list.filter((d) => matchesGenderFilter(d, 'male'))
  }
  if (filters.language?.trim()) {
    const lang = filters.language.trim().toLowerCase()
    list = list.filter((d) => d.languages?.some((l) => l.toLowerCase().includes(lang)))
  }

  return list
}
