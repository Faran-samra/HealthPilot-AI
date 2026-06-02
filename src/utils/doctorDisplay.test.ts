import { describe, expect, it } from 'vitest'
import { formatDoctorLocation } from '@/utils/doctorDisplay'

describe('formatDoctorLocation', () => {
  it('joins hospital area and city without nulls', () => {
    expect(
      formatDoctorLocation({
        hospital_name: 'Ammar Medical Complex Hospital',
        area: 'Jail Road',
        city: 'Lahore',
      })
    ).toBe('Ammar Medical Complex Hospital, Jail Road, Lahore')
  })
})
