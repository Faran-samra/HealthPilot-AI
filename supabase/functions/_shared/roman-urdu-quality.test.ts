import { describe, expect, it } from 'vitest'
import {
  buildSeizureRomanUrduSummary,
  looksLikeHindiRomanUrdu,
  polishPakistaniRomanUrdu,
} from './roman-urdu-quality.ts'

describe('roman-urdu-quality', () => {
  it('detects Hindi-style Roman Urdu', () => {
    expect(looksLikeHindiRomanUrdu('Aapko shikaarpurn neurologist se jhanknay ke liye')).toBe(true)
  })

  it('polishes common Hindi words to Pakistani Roman Urdu', () => {
    const out = polishPakistaniRomanUrdu('lagbhag 3 minute samasya hai')
    expect(out).toContain('takreeban')
    expect(out).toContain('masla')
    expect(out).not.toMatch(/lagbhag|samasya/)
  })

  it('builds seizure summary for new patient without medicine', () => {
    const text =
      'mujhe epilepsy hai pichle 5 dino se dawai ni le rha doctor k pass nahi 2 se 3 dfa 3 se 5 minute'
    const summary = buildSeizureRomanUrduSummary(text)
    expect(summary).toBeTruthy()
    expect(summary).toMatch(/neurologist/i)
    expect(summary).not.toMatch(/samasya|jhank|shikar/i)
    expect(summary).toMatch(/dawai mat lein|medicine mat/i)
  })

  it('mentions nearby doctor list when user asks for qareeb doctor', () => {
    const summary = buildSeizureRomanUrduSummary(
      'mujhe epilepsy hai docor suggest kr area k qareeb'
    )
    expect(summary).toMatch(/list|qareeb|GPS/i)
  })
})
