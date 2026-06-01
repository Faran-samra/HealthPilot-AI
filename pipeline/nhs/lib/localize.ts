import type { NhsLocalizedCondition, NhsStructuredCondition } from './types.ts'

const UK_TO_PK_REPLACEMENTS: [RegExp, string][] = [
  [/\bNHS\s*111\b/gi, 'Rescue 1122 or Edhi 115'],
  [/\b111\b(?=\s*(service|NHS))/gi, '1122'],
  [/\bcall\s*999\b/gi, 'call Rescue 1122 or go to the nearest hospital emergency'],
  [/\b999\b/g, '1122 (emergency)'],
  [/\bA&E\b/g, 'hospital emergency department'],
  [/\bA\s*&\s*E\b/g, 'hospital emergency department'],
  [/\byour\s+GP\b/gi, 'a general physician'],
  [/\bsee\s+a\s+GP\b/gi, 'see a general physician at a hospital OPD or clinic'],
  [/\bGP\b/g, 'general physician'],
  [/\bNHS\b/g, 'local healthcare services'],
  [/\bprimary care\b/gi, 'outpatient clinic'],
  [/\babdominal aortic aneurysm screening\b/gi, 'vascular screening (where available locally)'],
]

const PK_CONTEXT_TEMPLATE = `This information is adapted for users in Pakistan. For medical facts, refer to the clinical content above. For urgent care, use Rescue 1122, Edhi 115, or your nearest hospital emergency department rather than UK-specific services.`

export function localizeUkText(text: string): string {
  let out = text
  for (const [pattern, replacement] of UK_TO_PK_REPLACEMENTS) {
    out = out.replace(pattern, replacement)
  }
  return out.trim()
}

export function buildEmergencyAdvicePakistan(condition: NhsStructuredCondition): string {
  const parts: string[] = []

  if (condition.sections.when_to_seek_help || condition.when_to_seek_help_uk) {
    const raw = condition.sections.when_to_seek_help ?? condition.when_to_seek_help_uk ?? ''
    parts.push(localizeUkText(raw))
  }

  parts.push(
    'In Pakistan: For life-threatening symptoms (severe pain, difficulty breathing, loss of consciousness, heavy bleeding), go to the nearest hospital emergency or call Rescue 1122 / Edhi 115 immediately. For non-emergency concerns, visit a general physician or hospital OPD.'
  )

  return parts.join('\n\n')
}

export function localizeCondition(condition: NhsStructuredCondition): NhsLocalizedCondition {
  const emergency_advice_pakistan = buildEmergencyAdvicePakistan(condition)

  return {
    ...condition,
    sections: { ...condition.sections },
    emergency_advice_pakistan,
    localized_pakistan_context: `${PK_CONTEXT_TEMPLATE}\n\n${emergency_advice_pakistan}`,
    localized_at: new Date().toISOString(),
  }
}
