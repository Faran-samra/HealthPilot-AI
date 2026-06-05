import { describe, expect, it } from 'vitest'
import {
  detectConversationLanguage,
  isEnglishUserText,
  isRomanUrduText,
  messageTextDirection,
} from './romanUrdu'

describe('romanUrdu client', () => {
  it('detects Mujhe bukhar hai as Roman Urdu', () => {
    expect(isRomanUrduText('Mujhe bukhar hai')).toBe(true)
  })

  it('uses LTR for Roman Urdu assistant replies', () => {
    expect(messageTextDirection('Aap ko kitne din se bukhar hai?', 'ur')).toBe('ltr')
  })

  it('uses RTL for Urdu script', () => {
    expect(messageTextDirection('آپ کو کتنے دن سے بخار ہے؟', 'ur')).toBe('rtl')
  })

  it('infers ur from Roman Urdu even if UI was en', () => {
    expect(detectConversationLanguage(['Mujhe bukhar hai'], 'en')).toBe('ur')
  })

  it('detects English user text when app language is ur', () => {
    const english = 'I have had sneezing and watery eyes for 10 days outdoors.'
    expect(isEnglishUserText(english)).toBe(true)
    expect(detectConversationLanguage([english], 'ur')).toBe('en')
  })
})
