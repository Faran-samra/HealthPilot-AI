import { describe, expect, it } from 'vitest'
import { normalizeDoctorName } from './normalize.ts'
import { extractMarhamPractice } from './html-extract.ts'

describe('normalizeDoctorName', () => {
  it('does not prefix Dr. before Prof. Dr.', () => {
    expect(normalizeDoctorName('Prof. Dr. Haroon Javaid')).toBe('Prof. Dr. Haroon Javaid')
  })

  it('adds Dr. for plain names', () => {
    expect(normalizeDoctorName('Haroon Javaid')).toBe('Dr. Haroon Javaid')
  })
})

describe('extractMarhamPractice', () => {
  it('parses hospital and area from practice block', () => {
    const html = `
      Practice Address and Timings
      Ammar Medical Complex Hospital
      Area: Jail Road, Lahore
      Rs. 3,000
      | MBBS | FRCS (EDINBURGH) |
    `
    const p = extractMarhamPractice(html)
    expect(p.hospital_name).toContain('Ammar Medical')
    expect(p.area).toBe('Jail Road')
    expect(p.address).toContain('Jail Road')
    expect(p.qualification).toMatch(/MBBS/)
  })
})
