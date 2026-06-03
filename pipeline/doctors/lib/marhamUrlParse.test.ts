import { describe, expect, it } from 'vitest'
import {
  isMarhamDoctorProfileUrl,
  nameFromMarhamProfileSlug,
  parseMarhamProfilePath,
} from './marhamUrlParse.ts'

describe('parseMarhamProfilePath', () => {
  it('parses city/specialty/slug URLs', () => {
    const p = parseMarhamProfilePath(
      'https://www.marham.pk/doctors/faisalabad/pediatrician/dr-shujah-ud-din',
    )
    expect(p).toEqual({
      citySlug: 'faisalabad',
      specialtySlug: 'pediatrician',
      profileSlug: 'dr-shujah-ud-din',
    })
  })

  it('accepts name-only slugs (aqsa-ali)', () => {
    expect(
      isMarhamDoctorProfileUrl('https://www.marham.pk/doctors/lahore/nutritionist/aqsa-ali'),
    ).toBe(true)
  })

  it('rejects area listing pages', () => {
    expect(
      parseMarhamProfilePath('https://www.marham.pk/doctors/islamabad/area-g-11'),
    ).toBeNull()
  })

  it('rejects specialty directory pages (3 segments)', () => {
    expect(
      isMarhamDoctorProfileUrl('https://www.marham.pk/doctors/jhelum/pediatric-gastroenterologist'),
    ).toBe(false)
  })

  it('rejects city-only URLs', () => {
    expect(parseMarhamProfilePath('https://www.marham.pk/doctors/lahore')).toBeNull()
  })
})

describe('nameFromMarhamProfileSlug', () => {
  it('extracts name from profile slug', () => {
    expect(nameFromMarhamProfileSlug('dr-shujah-ud-din')).toBe('Shujah UD Din')
    expect(nameFromMarhamProfileSlug('assoc-prof-dr-salman-javed')).toBe('Salman Javed')
  })
})
