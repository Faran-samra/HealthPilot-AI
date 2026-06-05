import { getConditionAliases, getRomanUrduGloss } from './condition-aliases.ts'
import type { MedicalChunkDraft } from './types.ts'

const SECTION_LABELS: Record<string, string> = {
  emergency_advice_pakistan: 'Emergency and urgent care (Pakistan)',
  localized_pakistan_context: 'Pakistan healthcare context',
  overview: 'Overview',
  symptoms: 'Symptoms and signs',
  causes: 'Causes',
  diagnosis: 'Diagnosis and tests',
  treatment: 'Treatment',
  prevention: 'Prevention and vaccination',
  complications: 'Complications and who is at risk',
  self_care: 'Self-care and symptom relief',
  urgent_care: 'When to seek urgent care',
  emergency_care: 'Emergency warning signs',
  when_to_seek_help: 'When to get medical help',
  other: 'Additional clinical information',
}

const SECTION_SEARCH_KEYWORDS: Record<string, string> = {
  symptoms: 'signs, presentation, how it feels, red flags, warning signs',
  complications: 'risk groups, serious problems, when dangerous, complications',
  urgent_care: 'see doctor soon, urgent appointment, worsening, NHS 111 equivalent',
  emergency_care: 'emergency, call ambulance, 999, severe, life-threatening, A&E',
  treatment: 'management, medicines, surgery, hospital treatment, recovery',
  diagnosis: 'tests, scan, screening, diagnosis, check-up',
  causes: 'risk factors, why it happens, who is at risk',
  prevention: 'vaccine, prevention, lifestyle, avoid spreading',
  self_care: 'home care, relief, rest, fluids, over-the-counter',
  overview: 'what it is, summary, introduction',
}

/** Text embedded for vector search — richer than display-only body. */
export function buildEmbeddingText(draft: MedicalChunkDraft): string {
  const conditionTitle = draft.title.split('—')[0]?.trim() ?? draft.condition_slug
  const sectionLabel = SECTION_LABELS[draft.section] ?? draft.section
  const body = draft.content
    .replace(/^\[(Clinical reference|Pakistan guidance)[^\]]*\]\s*/i, '')
    .trim()

  const aliases = getConditionAliases(draft.condition_slug, conditionTitle)
  const romanUrdu = getRomanUrduGloss(draft.condition_slug)
  const urgency = draft.urgency ?? 'routine'
  const audience = draft.audience ?? 'general'

  const lines = [
    `Condition: ${conditionTitle}`,
    `Condition slug: ${draft.condition_slug}`,
    `Section: ${sectionLabel}`,
    `Urgency: ${urgency}`,
    `Audience: ${audience}`,
    `Search aliases: ${aliases.slice(0, 14).join(', ')}`,
    'Locale: Pakistan users — Rescue 1122, Edhi 115, hospital OPD',
    '',
    body,
  ]

  const sectionKw = SECTION_SEARCH_KEYWORDS[draft.section]
  if (sectionKw) lines.push('', `Related terms: ${sectionKw}`)

  if (romanUrdu) {
    lines.push('', `Common Pakistan phrases (Roman Urdu): ${romanUrdu}`)
  }

  if (draft.section === 'symptoms' || draft.section === 'complications') {
    lines.push('', 'Related: signs, symptoms, red flags, when to worry')
  }
  if (
    draft.section === 'emergency_advice_pakistan' ||
    draft.section === 'emergency_care' ||
    draft.section === 'urgent_care'
  ) {
    lines.push('', 'Related: emergency, urgent, severe, call ambulance, hospital now')
  }

  return lines.join('\n').slice(0, 8000)
}
