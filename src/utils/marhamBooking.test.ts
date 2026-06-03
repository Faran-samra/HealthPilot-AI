import { describe, expect, it } from 'vitest'
import { getMarhamCallcenterUrl, isMarhamDoctor } from './marhamBooking'

describe('getMarhamCallcenterUrl', () => {
  it('appends /callcenter to profile URL', () => {
    expect(
      getMarhamCallcenterUrl(
        'https://www.marham.pk/doctors/lahore/dermatologist/dr-tariq-niaz-butt',
      ),
    ).toBe('https://www.marham.pk/doctors/lahore/dermatologist/dr-tariq-niaz-butt/callcenter')
  })

  it('normalizes existing callcenter path', () => {
    expect(
      getMarhamCallcenterUrl(
        'https://www.marham.pk/doctors/gujranwala/urologist/dr-nadir-hussain/callcenter',
      ),
    ).toBe('https://www.marham.pk/doctors/gujranwala/urologist/dr-nadir-hussain/callcenter')
  })

  it('rejects listing pages', () => {
    expect(getMarhamCallcenterUrl('https://www.marham.pk/doctors/islamabad/anesthetist')).toBeNull()
  })

  it('rejects non-Marham URLs', () => {
    expect(getMarhamCallcenterUrl('https://example.com/doctors/lahore/x')).toBeNull()
  })
})

describe('isMarhamDoctor', () => {
  it('detects marham source', () => {
    expect(isMarhamDoctor({ source: 'marham' })).toBe(true)
    expect(isMarhamDoctor({ source: 'manual' })).toBe(false)
  })
})
