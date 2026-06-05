import { describe, expect, it } from 'vitest'
import { extractConditionFromHtml } from './extract.ts'

const WHOOPING_COUGH_HTML = `
<main>
  <h1>Whooping cough</h1>
  <p>Whooping cough (pertussis) is an infection of the lungs and breathing tubes.</p>
  <h2>Symptoms of whooping cough</h2>
  <p>The first signs are similar to a cold, such as a runny nose and sore throat.</p>
  <p>After about a week, you or your child will get coughing bouts that last for a few minutes.</p>
  <h2>Urgent advice: Ask for an urgent GP appointment or get help from NHS 111 if:</h2>
  <p>your baby is under 6 months old and has symptoms of whooping cough</p>
  <h2>Whooping cough can be dangerous</h2>
  <p>Babies under 12 months old have an increased chance of having problems such as dehydration and seizures (fits)</p>
  <h2>Immediate action required: Call 999 or go to A&amp;E if:</h2>
  <p>your child is having seizures (fits)</p>
  <h2>Treatment for whooping cough</h2>
  <p>Hospital treatment is usually needed if you have severe whooping cough.</p>
  <h2>How to ease the symptoms of whooping cough</h2>
  <p>get plenty of rest</p>
  <p>drink lots of fluids</p>
  <h2>The whooping cough vaccine</h2>
  <p>The whooping cough vaccine protects babies and children.</p>
</main>
`

describe('extractConditionFromHtml', () => {
  it('parses HTML lists as bullet lines', () => {
    const html = `
<main>
  <h1>Test condition</h1>
  <h2>Symptoms of test condition</h2>
  <ul>
    <li>tummy or back pain</li>
    <li>a pulsing feeling in your tummy</li>
  </ul>
</main>`
    const c = extractConditionFromHtml('https://www.nhs.uk/conditions/test/', html)
    expect(c.sections.symptoms).toMatch(/- tummy or back pain/)
    expect(c.sections.symptoms).toMatch(/- a pulsing feeling/)
    expect(c.sections.symptoms).not.toMatch(/paina pulsing/)
  })

  it('maps NHS headings into structured sections for whooping cough', () => {
    const c = extractConditionFromHtml('https://www.nhs.uk/conditions/whooping-cough/', WHOOPING_COUGH_HTML)
    expect(c.slug).toBe('whooping-cough')
    expect(c.sections.symptoms).toMatch(/coughing bouts/i)
    expect(c.sections.urgent_care).toMatch(/6 months/i)
    expect(c.sections.emergency_care).toMatch(/999|seizures/i)
    expect(c.sections.complications).toMatch(/dangerous|dehydration/i)
    expect(c.sections.treatment).toMatch(/Hospital treatment/i)
    expect(c.sections.self_care).toMatch(/rest|fluids/i)
    expect(c.sections.prevention).toMatch(/vaccine/i)
  })
})
