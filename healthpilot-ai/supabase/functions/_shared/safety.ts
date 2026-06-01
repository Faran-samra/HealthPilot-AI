import type { SymptomAnalysis } from './schemas.ts'
import { SPECIALTY_SLUGS, type SeverityLevel } from './models.ts'

const DIAGNOSIS_PHRASES = [
  /you have\s+\w+/i,
  /you are diagnosed with/i,
  /definitely\s+have/i,
  /confirmed\s+case of/i,
]

const EMERGENCY_NUMBERS = 'Rescue 1122 or Edhi 115'

export function applySafetyRules(
  analysis: SymptomAnalysis,
  userMessagesText = ''
): SymptomAnalysis {
  const out = { ...analysis }

  if (!SPECIALTY_SLUGS.includes(out.recommended_specialty_slug)) {
    out.recommended_specialty_slug = 'general'
    out.recommended_specialty = 'General Physician'
  }

  const combined = `${out.explanation} ${out.brief_summary}`.toLowerCase()
  for (const pattern of DIAGNOSIS_PHRASES) {
    if (pattern.test(combined)) {
      out.disclaimer =
        `${out.disclaimer} This tool does not provide a medical diagnosis. Please see a qualified doctor.`
      break
    }
  }

  if (out.severity_level === 'emergency') {
    if (!out.red_flags?.length) {
      out.red_flags = [
        `Seek emergency care immediately. Call ${EMERGENCY_NUMBERS}.`,
      ]
    } else {
      const hasNumber = out.red_flags.some((f) => /1122|115|edhi|rescue/i.test(f))
      if (!hasNumber) {
        out.red_flags = [
          ...out.red_flags,
          `Call ${EMERGENCY_NUMBERS} if symptoms are severe.`,
        ]
      }
    }
  }

  const chestEmergency =
    /chest pain|سینے کا درد/i.test(userMessagesText) &&
    /severe|crushing|radiat|بھاری|شدید/i.test(userMessagesText)
  if (chestEmergency && severityRank(out.severity_level) < severityRank('severe')) {
    out.severity_level = 'severe'
  }

  return out
}

function severityRank(s: SeverityLevel): number {
  const order: SeverityLevel[] = ['mild', 'moderate', 'severe', 'emergency']
  return order.indexOf(s)
}
