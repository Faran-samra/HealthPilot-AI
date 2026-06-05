import { describe, expect, it } from 'vitest'
import { rankDoctorsForSymptomSpecialty } from './doctorSpecialtyRank'

describe('rankDoctorsForSymptomSpecialty', () => {
  it('ranks cardiologists above psychiatrists for cardiology slug', () => {
    const ranked = rankDoctorsForSymptomSpecialty(
      [
        { specialty_slug: 'psychiatry', specialty: 'Psychiatrist' },
        { specialty_slug: 'cardiology', specialty: 'Cardiologist' },
        { specialty_slug: 'general', specialty: 'General Physician' },
      ],
      'cardiology'
    )
    expect(ranked[0].specialty_slug).toBe('cardiology')
    expect(ranked.some((d) => d.specialty_slug === 'psychiatry')).toBe(false)
  })

  it('ranks ent specialists above dentists for ent slug', () => {
    const ranked = rankDoctorsForSymptomSpecialty(
      [
        { specialty_slug: 'dentist', specialty: 'Dentist' },
        { specialty_slug: 'ent', specialty: 'ENT Specialist' },
        { specialty_slug: 'general', specialty: 'General Physician' },
      ],
      'ent'
    )
    expect(ranked[0].specialty_slug).toBe('ent')
    expect(ranked.some((d) => d.specialty_slug === 'dentist')).toBe(false)
  })
})
