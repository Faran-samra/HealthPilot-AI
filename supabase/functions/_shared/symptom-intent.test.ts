import { describe, expect, it } from 'vitest'
import {
  hasFeverSignals,
  isAllergicRhinitisPattern,
  isAllergyTriageSufficient,
  isPalpitationsPattern,
  isStressPalpitationsPattern,
  palpitationsRecommendedSlug,
} from './symptom-intent.ts'
import { buildConversationHints } from './symptom-prompts.ts'
import { detectConversationLanguage } from './roman-urdu.ts'

const ALLERGY_ENGLISH =
  'For the last 10 days I have had sneezing, watery eyes, mild cough, and a blocked nose that gets worse outdoors, especially in dusty or windy areas.'

describe('symptom-intent', () => {
  it('detects allergic rhinitis without fever', () => {
    expect(isAllergicRhinitisPattern(ALLERGY_ENGLISH)).toBe(true)
    expect(hasFeverSignals(ALLERGY_ENGLISH)).toBe(false)
  })

  it('does not classify fever case as allergy', () => {
    expect(isAllergicRhinitisPattern('Mujhe 5 din se bukhar hai aur khansi')).toBe(false)
    expect(hasFeverSignals('Mujhe 5 din se bukhar hai')).toBe(true)
  })

  it('ignores negated fever mentions', () => {
    const text = 'sneezing, watery eyes, blocked nose, no fever'
    expect(hasFeverSignals(text)).toBe(false)
    expect(isAllergicRhinitisPattern(text)).toBe(true)
  })

  it('detects sufficient allergy triage from detailed first message', () => {
    const lines = [
      'I have sneezing and itchy eyes for 1 week, worse in the morning and outdoors in dust. I have not taken antihistamines.',
    ]
    expect(isAllergyTriageSufficient(lines)).toBe(true)
  })
})

const PALPITATIONS =
  'For 6 days heart beating fast when stressed or after tea, less than a minute, no chest pain, anxious during exams, poor sleep'

describe('palpitations intent', () => {
  it('detects stress-related palpitations', () => {
    expect(isPalpitationsPattern(PALPITATIONS)).toBe(true)
    expect(isStressPalpitationsPattern(PALPITATIONS)).toBe(true)
    expect(palpitationsRecommendedSlug(PALPITATIONS)).toBe('cardiology')
  })
})

describe('language + allergy hints', () => {
  it('detects English even when UI language is ur', () => {
    expect(detectConversationLanguage([ALLERGY_ENGLISH], 'ur')).toBe('en')
  })

  it('builds allergy follow-up hints in English, not fever', () => {
    const hints = buildConversationHints({
      userText: ALLERGY_ENGLISH,
      language: 'en',
      phase: 'follow_up',
      assistantLines: [],
    })
    expect(hints.replyInUrdu).toBe(false)
    expect(hints.blockText).toMatch(/ENGLISH/)
    expect(hints.blockText).toMatch(/allergic rhinitis/i)
    expect(hints.blockText).toMatch(/antihistamine/i)
    expect(hints.blockText).not.toMatch(/fever triage/i)
    expect(hints.infectionSignals).toBe(true)
    expect(hints.blockText).not.toMatch(/kitna bukhar|Bukhar ho raha/i)
  })
})
