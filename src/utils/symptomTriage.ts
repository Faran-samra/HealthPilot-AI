import type { AIAnalysisResult } from '@/lib/database.types'
import type { QuickTriageResult } from '@/types/symptomChat'

const EMERGENCY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /chest pain|heart attack|crushing chest/i, label: 'Chest pain' },
  { pattern: /can't breathe|cannot breathe|difficulty breathing|shortness of breath|gasping/i, label: 'Breathing difficulty' },
  { pattern: /stroke|face droop|slurred speech|one side weak/i, label: 'Possible stroke' },
  { pattern: /unconscious|passed out|fainted|not responding/i, label: 'Loss of consciousness' },
  { pattern: /severe bleeding|heavy bleeding|blood vomiting/i, label: 'Severe bleeding' },
  { pattern: /suicid|self harm|kill myself/i, label: 'Mental health emergency' },
  { pattern: /seizure|convulsion|fits/i, label: 'Seizure' },
]

const SEVERE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /high fever|104|105|very high fever|40\.?5|41\.?0/i, label: 'High fever' },
  { pattern: /severe pain|intolerable pain|worst pain/i, label: 'Severe pain' },
  { pattern: /blood in stool|blood in urine|bloody/i, label: 'Bleeding' },
  { pattern: /sudden severe headache|thunderclap/i, label: 'Sudden severe headache' },
]

/** Instant client-side triage — runs in <1ms for immediate UI feedback. */
export function quickTriage(text: string): QuickTriageResult {
  const matched: string[] = []

  for (const { pattern, label } of EMERGENCY_PATTERNS) {
    if (pattern.test(text)) matched.push(label)
  }
  if (matched.length > 0) {
    return {
      severity: 'emergency',
      label: matched[0],
      isEmergency: true,
      matchedKeywords: matched,
    }
  }

  for (const { pattern, label } of SEVERE_PATTERNS) {
    if (pattern.test(text)) matched.push(label)
  }
  if (matched.length > 0) {
    return {
      severity: 'severe',
      label: matched[0],
      isEmergency: false,
      matchedKeywords: matched,
    }
  }

  if (/fever|bukhār|بخار/i.test(text)) {
    return { severity: 'moderate', label: 'Fever reported', isEmergency: false, matchedKeywords: ['fever'] }
  }

  return { severity: null, label: '', isEmergency: false, matchedKeywords: [] }
}

/** Normalize conversation text for cache lookup. */
export function normalizeSymptomKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .sort()
    .slice(0, 8)
    .join(' ')
}

export interface CachedPattern {
  brief_summary: string
  severity_level: AIAnalysisResult['severity_level']
  recommended_specialty: string
  recommended_specialty_slug: string
  primary_condition: string
}

const PATTERN_CACHE: Record<string, CachedPattern> = {
  'day fever headache': {
    brief_summary: 'Fever with headache — common viral illness, but rule out dengue/typhoid in Pakistan.',
    severity_level: 'moderate',
    recommended_specialty: 'General Physician',
    recommended_specialty_slug: 'general',
    primary_condition: 'Viral fever / Dengue screening',
  },
  'fever headache': {
    brief_summary: 'Fever and headache — see a general physician; consider dengue/typhoid tests.',
    severity_level: 'moderate',
    recommended_specialty: 'General Physician',
    recommended_specialty_slug: 'general',
    primary_condition: 'Febrile illness',
  },
  'cough fever': {
    brief_summary: 'Cough with fever — may indicate respiratory infection; monitor breathing.',
    severity_level: 'moderate',
    recommended_specialty: 'General Physician',
    recommended_specialty_slug: 'general',
    primary_condition: 'Respiratory infection',
  },
  'chest pain': {
    brief_summary: 'Chest pain needs urgent medical evaluation — do not delay.',
    severity_level: 'severe',
    recommended_specialty: 'Cardiologist',
    recommended_specialty_slug: 'cardiology',
    primary_condition: 'Chest pain (cardiac evaluation needed)',
  },
  'skin rash': {
    brief_summary: 'Skin rash — dermatology review recommended if spreading or painful.',
    severity_level: 'mild',
    recommended_specialty: 'Dermatologist',
    recommended_specialty_slug: 'dermatology',
    primary_condition: 'Skin rash',
  },
  'back pain': {
    brief_summary: 'Back pain — orthopedic or GP evaluation based on duration and severity.',
    severity_level: 'moderate',
    recommended_specialty: 'Orthopedic',
    recommended_specialty_slug: 'orthopedics',
    primary_condition: 'Back pain',
  },
}

export function lookupSymptomCache(conversationText: string): CachedPattern | null {
  const key = normalizeSymptomKey(conversationText)
  if (PATTERN_CACHE[key]) return PATTERN_CACHE[key]

  for (const [cacheKey, value] of Object.entries(PATTERN_CACHE)) {
    const words = cacheKey.split(' ')
    if (words.every((w) => key.includes(w))) return value
  }

  return null
}
