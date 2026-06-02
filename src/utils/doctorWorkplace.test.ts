import { describe, expect, it } from 'vitest'
import { cleanWorkplaceName, getDisplayWorkplace } from '@/utils/doctorWorkplace'

describe('cleanWorkplaceName', () => {
  it('extracts venue after "at"', () => {
    expect(
      cleanWorkplaceName(
        'Dr. Muhammad Waris Farooqa - General Surgeon at National Hospital',
      ),
    ).toBe('National Hospital')
  })

  it('extracts clinic name', () => {
    expect(
      cleanWorkplaceName(
        'Dr. Imran Hashim - Pediatric Surgeon at Dr Huma Farooq Clinic',
      ),
    ).toBe('Dr Huma Farooq Clinic')
  })

  it('keeps plain hospital names', () => {
    expect(cleanWorkplaceName('National Hospital')).toBe('National Hospital')
  })
})

describe('getDisplayWorkplace', () => {
  it('prefers cleaned hospital_name', () => {
    expect(
      getDisplayWorkplace({
        hospital_name: 'Dr. Qaiser Mahmood - Radiologist at Dr Huma Farooq Clinic',
      }),
    ).toBe('Dr Huma Farooq Clinic')
  })
})
