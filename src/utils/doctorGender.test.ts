import { describe, expect, it } from 'vitest'
import { inferGenderFromName, matchesGenderFilter, resolveDoctorGender } from '@/utils/doctorGender'

describe('doctorGender', () => {
  it('infers female from common Pakistani given names', () => {
    expect(inferGenderFromName('Dr. Naima Shirazi')).toBe('female')
    expect(inferGenderFromName('Dr. Ghazala Aslam')).toBe('female')
    expect(inferGenderFromName('Dr. Aneeqa Bano')).toBe('female')
  })

  it('uses stored gender when present', () => {
    expect(resolveDoctorGender('female', 'Dr. Ahmed Hassan')).toBe('female')
    expect(resolveDoctorGender('male', 'Dr. Fatima Khan')).toBe('male')
  })

  it('filters female-only strictly', () => {
    expect(matchesGenderFilter({ gender: null, full_name: 'Dr. Samira Rizwan' }, 'female')).toBe(true)
    expect(matchesGenderFilter({ gender: null, full_name: 'Dr. Imran Hashim' }, 'female')).toBe(false)
  })

  it('filters male including unknown gender', () => {
    expect(matchesGenderFilter({ gender: null, full_name: 'Dr. Imran Hashim' }, 'male')).toBe(true)
    expect(matchesGenderFilter({ gender: null, full_name: 'Dr. Samira Rizwan' }, 'male')).toBe(false)
    expect(matchesGenderFilter({ gender: 'female', full_name: 'Dr. Fatima Khan' }, 'male')).toBe(false)
  })
})
