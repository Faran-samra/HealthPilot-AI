import { describe, expect, it } from 'vitest'
import {
  extractMarhamConsultationFee,
  extractMarhamProfileDetails,
} from './html-extract.ts'
import { isMarhamBoilerplateStatement } from '../../../src/utils/marhamProfileText.ts'

const SAMPLE_HTML = `
Practice Address and Timings
Surgimed Hospital
Area: Gulberg 4, Lahore
Rs. 2,500
Available Timings
Mon	06:30 PM - 09:00 PM
Wed	06:30 PM - 09:00 PM
No extra charges
Starting from Rs. 500
<h3>Services</h3>
<li>Dizziness</li>
<li>Hearing Aid Fitting</li>
<h3>Diseases</h3>
<li>Sinusitis</li>
Professional Statement by Dr. Brig R Zubair Ahmed
Dr. Brig R Zubair Ahmed is a renowned Ent Specialist based in Lahore. There are multiple doctors operating in Lahore but Dr. Brig R Zubair Ahmed has managed to gain a well-known reputation through their professional practice in the of Ent Specialist. Ent Specialist has high amount of significance in the medical and healthcare fields.
`

describe('extractMarhamConsultationFee', () => {
  it('uses fee from practice block not sidebar promo', () => {
    expect(extractMarhamConsultationFee(SAMPLE_HTML)).toBe(2500)
  })
})

const TABLE_TIMINGS_HTML = `
Available Timings
<table><tbody>
<tr><td>Mon</td><td>06:30 PM - 09:00 PM</td></tr>
<tr><td>Wed</td><td>06:30 PM - 09:00 PM</td></tr>
</tbody></table>
No extra charges
`

describe('extractMarhamProfileDetails', () => {
  it('skips boilerplate statement and parses services', () => {
    const d = extractMarhamProfileDetails(SAMPLE_HTML, 'Dr. Brig R Zubair Ahmed')
    expect(d.professional_statement).toBeUndefined()
    expect(d.services).toContain('Dizziness')
    expect(d.practice_timings?.map((t) => t.day)).toEqual(['Mon', 'Wed'])
    expect(d.practice_timings?.[0]?.end).toBe('21:00')
  })

  it('parses timings from HTML table rows', () => {
    const d = extractMarhamProfileDetails(TABLE_TIMINGS_HTML, 'Dr. Test')
    expect(d.practice_timings?.map((t) => t.day)).toEqual(['Mon', 'Wed'])
  })
})

describe('isMarhamBoilerplateStatement', () => {
  it('detects template copy', () => {
    expect(
      isMarhamBoilerplateStatement(
        'Dr. X is a renowned Cardiologist based in Lahore. There are multiple doctors operating in Lahore but Dr. X has managed to gain a well-known reputation.',
      ),
    ).toBe(true)
  })
})
