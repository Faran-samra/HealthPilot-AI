import { describe, expect, it } from 'vitest'
import {
  detectCityInText,
  parseCityFromLocationText,
  parseCityFromMarhamSlug,
  resolveMarhamDoctorCity,
} from '@/utils/pakistanCityExtract'

describe('pakistanCityExtract', () => {
  it('parses city from Marham slug suffix', () => {
    expect(parseCityFromMarhamSlug('dr-naveed-qureshi-eye-surgeon-rawalpindi')).toBe('rawalpindi')
    expect(parseCityFromMarhamSlug('dr-bashir-general-physician-karachi')).toBe('karachi')
  })

  it('does not treat lahore as substring of unrelated words', () => {
    expect(detectCityInText('North Nazimabad, Karachi')).toBe('karachi')
    expect(detectCityInText('Cantt, Rawalpindi')).toBe('rawalpindi')
  })

  it('parses city from Marham Area line', () => {
    expect(parseCityFromLocationText('North Nazimabad, Karachi')).toBe('karachi')
    expect(parseCityFromLocationText('Cantt, Rawalpindi')).toBe('rawalpindi')
  })

  it('prefers Area line over wrong slug default', () => {
    const r = resolveMarhamDoctorCity({
      profileSlug: 'dr-x-eye-surgeon-lahore',
      areaLine: 'Cantt, Rawalpindi',
    })
    expect(r.city_slug).toBe('rawalpindi')
    expect(r.city).toBe('Rawalpindi')
  })
})
