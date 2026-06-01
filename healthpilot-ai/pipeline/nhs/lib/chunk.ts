import type { MedicalChunkDraft, NhsLocalizedCondition } from './types.ts'

const SECTION_PRIORITY: Array<{ key: keyof NhsLocalizedCondition['sections'] | 'emergency' | 'context'; section: string }> = [
  { key: 'emergency', section: 'emergency_advice_pakistan' },
  { key: 'context', section: 'localized_pakistan_context' },
  { key: 'overview', section: 'overview' },
  { key: 'symptoms', section: 'symptoms' },
  { key: 'causes', section: 'causes' },
  { key: 'diagnosis', section: 'diagnosis' },
  { key: 'treatment', section: 'treatment' },
  { key: 'prevention', section: 'prevention' },
]

const MAX_CHUNK_CHARS = 1200

function splitLongText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const paragraphs = text.split(/\n\n+/)
  const chunks: string[] = []
  let buf = ''
  for (const p of paragraphs) {
    if ((buf + '\n\n' + p).length > maxLen && buf) {
      chunks.push(buf.trim())
      buf = p
    } else {
      buf = buf ? `${buf}\n\n${p}` : p
    }
  }
  if (buf.trim()) chunks.push(buf.trim())
  return chunks
}

export function conditionToChunks(condition: NhsLocalizedCondition): MedicalChunkDraft[] {
  const chunks: MedicalChunkDraft[] = []
  const baseTitle = condition.condition_name

  if (condition.emergency_advice_pakistan) {
    for (const [i, part] of splitLongText(condition.emergency_advice_pakistan, MAX_CHUNK_CHARS).entries()) {
      chunks.push({
        slug: `nhs-${condition.slug}-emergency-${i}`,
        title: `${baseTitle} — Emergency advice (Pakistan)`,
        content: `[Pakistan guidance — adapted from UK NHS source]\n\n${part}`,
        source: 'nhs_uk',
        source_url: condition.source_url,
        condition_slug: condition.slug,
        section: 'emergency_advice_pakistan',
        locale: 'en-PK',
        specialty_tags: [],
      })
    }
  }

  if (condition.localized_pakistan_context) {
    chunks.push({
      slug: `nhs-${condition.slug}-context`,
      title: `${baseTitle} — Pakistan context`,
      content: condition.localized_pakistan_context,
      source: 'nhs_uk',
      source_url: condition.source_url,
      condition_slug: condition.slug,
      section: 'localized_pakistan_context',
      locale: 'en-PK',
      specialty_tags: [],
    })
  }

  for (const { key, section } of SECTION_PRIORITY) {
    if (key === 'emergency' || key === 'context') continue
    const text = condition.sections[key as keyof typeof condition.sections]
    if (!text?.trim()) continue

    const parts = splitLongText(text, MAX_CHUNK_CHARS)
    for (const [i, part] of parts.entries()) {
      chunks.push({
        slug: `nhs-${condition.slug}-${section}${parts.length > 1 ? `-${i}` : ''}`,
        title: `${baseTitle} — ${section}`,
        content: `[Clinical reference — NHS UK source, facts unchanged]\n\n${part}`,
        source: 'nhs_uk',
        source_url: condition.source_url,
        condition_slug: condition.slug,
        section,
        locale: 'en-GB',
        specialty_tags: [],
      })
    }
  }

  return chunks
}
