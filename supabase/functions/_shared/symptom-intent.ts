/**
 * Symptom intent classification for triage follow-ups and analysis routing.
 */

import { textForInfectionSignals } from './symptom-query.ts'

export function hasFeverSignals(text: string): boolean {
  const signal = textForInfectionSignals(text)
  const deniedFever =
    /\b(no|not|without|deny|denied|nahi|nahin|ni)\b[^.]{0,40}\b(fever|bukhar|bukhaar|temperature)\b/i.test(
      text
    ) ||
    /\b(fever|bukhar|bukhaar|temperature)\b[^.]{0,20}\b(no|not|nahi|nahin|ni)\b/i.test(text)
  if (deniedFever) return false

  return (
    /\bfever\b|bukhar|bukhaar|بخار|high temperature|temperature of|feels hot|feeling hot/i.test(
      signal
    ) || /\d+\s*°|degrees?\s*f/i.test(text)
  )
}

/** Sneezing + watery/blocked nose + outdoor/dust trigger, without fever. */
export function isAllergicRhinitisPattern(text: string): boolean {
  if (hasFeverSignals(text)) return false
  const t = text.toLowerCase()
  const markers = [
    /\bsneez/i.test(t),
    /watery eyes|itchy eyes|eyes watering|itching eyes/i.test(t),
    /blocked nose|stuffy nose|runny nose|nasal congestion|congested nose|blocked nose/i.test(t),
    /itchy nose|nose itch/i.test(t),
    /(worse|bad).*(outdoor|outside|dust|wind|pollen)|outdoors?|dusty|windy|pollen|hay fever|seasonal allergy/i.test(
      t
    ),
  ]
  return markers.filter(Boolean).length >= 2
}

/** Enough detail to finalize allergy triage without extra LLM turns. */
export function isAllergyTriageSufficient(userLines: string[]): boolean {
  const text = userLines.join(' ').toLowerCase()
  if (!isAllergicRhinitisPattern(text)) return false

  const hasMedContext =
    /antihistamine|cetirizine|loratadine|not taken|haven't taken|have not taken|no medicine|dawai nahi/i.test(
      text
    )
  const hasTriggers =
    /outdoor|outside|dust|wind|pollen|morning|wake up|subah/i.test(text)
  const hasDuration = /\d+\s*(day|days|week|weeks)|past\s+\d|for\s+(the\s+)?\d|1 week/i.test(text)

  return hasMedContext && hasTriggers && hasDuration
}

export function isPalpitationsPattern(text: string): boolean {
  return /heart\s+beat(ing)?\s*(fast|quick|racing)|racing\s+heart|fast\s+heartbeat|palpitation|tachycardia|dharkan\s+tez|dil\s+ki\s+dharkan|heart\s+rate\s+high/i.test(
    text
  )
}

export function hasCardiacRedFlags(text: string): boolean {
  if (/\b(no|not|without|deny|denied)\b[^.]{0,40}\bchest\s+pain\b/i.test(text)) {
    // still check other red flags
  } else if (/chest\s+pain|crushing\s+chest|pressure\s+in\s+chest/i.test(text)) {
    return true
  }
  return /shortness of breath|can't breathe|cannot breathe|faint|syncope|passed\s+out|unconscious|severe\s+dizziness/i.test(
    text
  )
}

/** Stress, caffeine, sleep loss — common benign palpitation triggers. */
export function isStressPalpitationsPattern(text: string): boolean {
  if (!isPalpitationsPattern(text)) return false
  if (hasCardiacRedFlags(text)) return false
  return /stress|anxious|anxiety|exam|tea|coffee|caffeine|sleep|neend|rest/i.test(text)
}

export function palpitationsRecommendedSlug(
  text: string
): 'cardiology' | 'general' | 'psychiatry' {
  if (!isPalpitationsPattern(text)) {
    if (/anxious|anxiety|panic|exam\s+stress/i.test(text) && !isPalpitationsPattern(text)) {
      return 'psychiatry'
    }
    return 'general'
  }
  if (hasCardiacRedFlags(text)) return 'cardiology'
  return 'cardiology'
}
