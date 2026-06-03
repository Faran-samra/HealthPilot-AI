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

const FARINA_HTML = `
Practice Address and Timings
Hearing Clinic
Area: Gulberg 3 , Lahore
Rs. 1,000
Available Timings
Mon	11:00 AM - 07:00 PM
No extra charges
Starting from Rs. 500
Get Affordable Care from Audiologists in Lahore
hadia-sultan-audiologist-lahore
Rs. 2000
`

const NUZHAT_HTML = `
Practice Address and Timings
Dr Huma Farooq Clinic
Area: DHA, Lahore
Rs. 2,000
Available Timings
No extra charges
Starting from Rs. 500
dr-asma-jabeen-gynecologist-lahore
Rs. 500
`

const HAMID_KHOKAR_HTML = `
Practice Address and Timings
Hijaz Hospital
Area: Gulberg 3, Lahore
Rs. 150
Available Timings
Mon	10:00 AM - 02:00 PM
No extra charges
Starting from Rs. 500
dr-hina-mudassar-pathologist-lahore
Rs. 500
`

const SAEED_AHMAD_HTML = `
Practice Address and Timings
Kaleem Medical Center
Area: Model Town, Lahore
Rs. 1,500
Available Timings
Mon	03:00 PM - 04:00 PM
No extra charges
Starting from Rs. 500
dr-imran-zia-dentist-lahore
Rs. 1000
`

describe('extractMarhamConsultationFee', () => {
  it('uses fee from practice block not sidebar promo', () => {
    expect(extractMarhamConsultationFee(SAMPLE_HTML)).toBe(2500)
  })

  it('uses Area band fee for Dr. Farina Latif (not Starting from Rs. 500)', () => {
    expect(extractMarhamConsultationFee(FARINA_HTML)).toBe(1000)
  })

  it('uses Area band fee for Dr. Nuzhat (not related doctor Rs. 500)', () => {
    expect(extractMarhamConsultationFee(NUZHAT_HTML)).toBe(2000)
  })

  it('uses Rs. 150 for pathologist (not Starting from Rs. 500)', () => {
    expect(extractMarhamConsultationFee(HAMID_KHOKAR_HTML)).toBe(150)
  })

  it('uses Rs. 1,500 for dentist (not related doctor Rs. 1000)', () => {
    expect(extractMarhamConsultationFee(SAEED_AHMAD_HTML)).toBe(1500)
  })

  it('ignores generic JSON fee promo when Area band is missing', () => {
    const html = `"fee":500\nStarting from Rs. 500\nGet Affordable Care`
    expect(extractMarhamConsultationFee(html)).toBeNull()
  })

  it('does not match area: inside textarea:focus CSS', () => {
    const cssThenPractice = `
textarea:focus { outline: 0; }
Practice Address and Timings
<p class="">Area: Gulberg 3, Lahore</p>
<p class="">Rs. 150 </p>
<p class="text-bold">Available Timings</p>
`
    expect(extractMarhamConsultationFee(cssThenPractice)).toBe(150)
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
