import { describe, expect, it } from 'vitest'
import {
  dedupeParagraphs,
  fixGluedListItems,
  normalizeSectionText,
  splitBulletBlocks,
} from './text-cleanup.ts'

describe('text-cleanup', () => {
  it('fixes glued risk-factor list items', () => {
    const raw =
      'You are more at risk if you: are male and aged 65 or oversmoke or used to smokehave high blood pressurehave high cholesterol'
    const out = fixGluedListItems(raw)
    expect(out).toMatch(/over smoke/i)
    expect(out).toMatch(/pressure have/i)
    expect(out).toMatch(/cholesterol/)
  })

  it('dedupes repeated paragraphs', () => {
    const a = 'An ultrasound test is offered to all men when they turn 65.'
    const out = dedupeParagraphs(`${a}\n\n${a}`)
    expect(out).toBe(a)
  })

  it('splits bullet blocks for symptom chunks', () => {
    const text = 'Symptoms\n\n- tummy or back pain\n- pulsing feeling in your tummy'
    const parts = splitBulletBlocks(text)
    expect(parts).toHaveLength(2)
    expect(parts[1]).toMatch(/pulsing/)
  })

  it('normalizes section end-to-end', () => {
    const out = normalizeSectionText('line one\n\nline one')
    expect(out).toBe('line one')
  })
})
