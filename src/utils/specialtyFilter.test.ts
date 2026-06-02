import { describe, expect, it } from 'vitest'
import { doctorMatchesSpecialtyFilter } from '@/utils/specialtyFilter'

describe('doctorMatchesSpecialtyFilter', () => {
  it('matches canonical slug', () => {
    expect(
      doctorMatchesSpecialtyFilter(
        { specialty_slug: 'gynecology', specialty: 'Gynecologist' },
        'gynecology'
      )
    ).toBe(true)
  })

  it('matches Marham-style slug', () => {
    expect(
      doctorMatchesSpecialtyFilter(
        { specialty_slug: 'pediatric_surgeon', specialty: 'Pediatric Surgeon' },
        'pediatrics'
      )
    ).toBe(true)
  })

  it('rejects unrelated specialty', () => {
    expect(
      doctorMatchesSpecialtyFilter(
        { specialty_slug: 'dentist', specialty: 'Dentist' },
        'cardiology'
      )
    ).toBe(false)
  })
})
