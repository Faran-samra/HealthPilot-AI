import { describe, expect, it } from 'vitest'
import {
  detectConversationLanguage,
  detectUrduVariant,
  isEnglishUserText,
  isRomanUrduText,
  isUrduUserText,
} from './roman-urdu.ts'

describe('roman-urdu', () => {
  it('detects Roman Urdu fever message', () => {
    expect(isRomanUrduText('Mujhe bukhar hai')).toBe(true)
    expect(isUrduUserText('Mujhe bukhar hai')).toBe(true)
  })

  it('detects Urdu script separately from Roman', () => {
    expect(isRomanUrduText('آپ کو بخار ہے')).toBe(false)
    expect(detectUrduVariant(['Mujhe bukhar hai'])).toBe('roman')
    expect(detectUrduVariant(['آپ کو بخار ہے'])).toBe('script')
  })

  it('infers ur language from Roman Urdu when client sent en', () => {
    expect(detectConversationLanguage(['Mujhe bukhar hai'], 'en')).toBe('ur')
  })

  it('detects English symptom narrative when UI is ur', () => {
    const english =
      'For the last 10 days I have had sneezing, watery eyes, and a blocked nose worse outdoors.'
    expect(isEnglishUserText(english)).toBe(true)
    expect(detectConversationLanguage([english], 'ur')).toBe('en')
  })
})
