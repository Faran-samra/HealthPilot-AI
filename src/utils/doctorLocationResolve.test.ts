import { describe, expect, it } from 'vitest'
import { resolveDoctorMapPosition } from '@/utils/doctorLocationResolve'

describe('resolveDoctorMapPosition', () => {
  it('uses hospital name when coords are city center', () => {
    const pos = resolveDoctorMapPosition({
      latitude: 31.5204,
      longitude: 74.3587,
      city_slug: 'lahore',
      city: 'Lahore',
      area: null,
      address: null,
      hospital_name: 'Services Hospital',
      clinic_name: null,
    })
    expect(pos.precision).toBe('hospital')
    expect(pos.lat).not.toBe(31.5204)
  })

  it('uses area from address text', () => {
    const pos = resolveDoctorMapPosition({
      latitude: null,
      longitude: null,
      city_slug: 'lahore',
      city: 'Lahore',
      area: 'Gulberg',
      address: null,
      hospital_name: null,
      clinic_name: null,
    })
    expect(pos.precision).toBe('area')
    expect(pos.lat).toBeCloseTo(31.515, 1)
  })
})
