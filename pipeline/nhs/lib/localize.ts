import type { NhsLocalizedCondition, NhsStructuredCondition } from './types.ts'
import { localizeUkText } from './localize-uk.ts'

export { localizeUkText } from './localize-uk.ts'

const PK_CONTEXT_TEMPLATE = `This information is adapted for users in Pakistan. For medical facts, see the clinical sections. For emergencies use Rescue 1122, Edhi 115, or your nearest hospital emergency department — not UK NHS services.`

const GENERIC_PK_EMERGENCY_LINE =
  'In Pakistan: For life-threatening symptoms (severe pain, difficulty breathing, loss of consciousness, heavy bleeding), go to the nearest hospital emergency or call Rescue 1122 / Edhi 115 immediately. For non-emergency concerns, visit a general physician or hospital OPD.'

/** True when the NHS page has condition-specific urgent/emergency content worth a dedicated chunk. */
export function hasConditionSpecificCareGuidance(condition: NhsStructuredCondition): boolean {
  const s = condition.sections
  return Boolean(
    s.urgent_care?.trim() ||
      s.emergency_care?.trim() ||
      (condition.when_to_seek_help_uk && condition.when_to_seek_help_uk.length > 120)
  )
}

export function buildEmergencyAdvicePakistan(condition: NhsStructuredCondition): string | undefined {
  if (!hasConditionSpecificCareGuidance(condition)) return undefined

  const parts: string[] = []
  const raw =
    [condition.sections.urgent_care, condition.sections.emergency_care, condition.sections.when_to_seek_help]
      .filter(Boolean)
      .join('\n\n') ||
    condition.when_to_seek_help_uk ||
    ''

  if (raw.trim()) parts.push(localizeUkText(raw))
  parts.push(GENERIC_PK_EMERGENCY_LINE)
  return parts.join('\n\n')
}

export function localizeCondition(condition: NhsStructuredCondition): NhsLocalizedCondition {
  const emergency_advice_pakistan = buildEmergencyAdvicePakistan(condition)
  const localized_pakistan_context = emergency_advice_pakistan
    ? `${PK_CONTEXT_TEMPLATE}\n\n${emergency_advice_pakistan}`
    : PK_CONTEXT_TEMPLATE

  return {
    ...condition,
    sections: { ...condition.sections },
    emergency_advice_pakistan,
    localized_pakistan_context,
    localized_at: new Date().toISOString(),
  }
}
