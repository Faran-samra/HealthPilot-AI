import { buildEmbeddingText } from './embed-text.ts'
import { applyChunkMetadata, buildSharedPakistanEmergencyChunk } from './chunk-meta.ts'
import type { MedicalChunkDraft, NhsLocalizedCondition } from './types.ts'
import { localizeUkText } from './localize.ts'
import { normalizeSectionText, splitBulletBlocks } from './text-cleanup.ts'

const MAX_CHUNK_CHARS = 1400
const SYMPTOM_BULLET_MAX_CHARS = 520

const CLINICAL_SECTIONS: Array<{
  key: keyof NhsLocalizedCondition['sections'] | 'emergency' | 'context' | 'urgent' | 'emergency_signs'
  section: string
  titleSuffix: string
  locale: string
  pakistanNote?: boolean
  splitBullets?: boolean
}> = [
  { key: 'emergency', section: 'emergency_advice_pakistan', titleSuffix: 'Emergency & urgent care (Pakistan)', locale: 'en-PK', pakistanNote: true },
  { key: 'context', section: 'localized_pakistan_context', titleSuffix: 'Pakistan context', locale: 'en-PK', pakistanNote: true },
  { key: 'urgent', section: 'urgent_care', titleSuffix: 'When to seek urgent care', locale: 'en-PK', pakistanNote: true },
  { key: 'emergency_signs', section: 'emergency_care', titleSuffix: 'Emergency warning signs', locale: 'en-PK', pakistanNote: true },
  { key: 'overview', section: 'overview', titleSuffix: 'Overview', locale: 'en-GB' },
  { key: 'symptoms', section: 'symptoms', titleSuffix: 'Symptoms', locale: 'en-GB', splitBullets: true },
  { key: 'complications', section: 'complications', titleSuffix: 'Complications & risk groups', locale: 'en-GB', splitBullets: true },
  { key: 'causes', section: 'causes', titleSuffix: 'Causes', locale: 'en-GB', splitBullets: true },
  { key: 'diagnosis', section: 'diagnosis', titleSuffix: 'Diagnosis', locale: 'en-GB' },
  { key: 'treatment', section: 'treatment', titleSuffix: 'Treatment', locale: 'en-GB' },
  { key: 'self_care', section: 'self_care', titleSuffix: 'Self-care & relief', locale: 'en-GB', splitBullets: true },
  { key: 'prevention', section: 'prevention', titleSuffix: 'Prevention & vaccines', locale: 'en-GB' },
]

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

function formatChunkBody(
  part: string,
  opts: { pakistanNote?: boolean }
): string {
  const header = opts.pakistanNote
    ? `[Pakistan guidance — adapted from NHS UK; emergencies: Rescue 1122 / Edhi 115]\n\n`
    : `[Clinical reference — NHS UK (Open Government Licence); facts unchanged]\n\n`
  return `${header}${opts.pakistanNote ? localizeUkText(part) : part}`
}

function finalizeDraft(draft: MedicalChunkDraft): MedicalChunkDraft {
  applyChunkMetadata(draft)
  draft.embedding_text = buildEmbeddingText(draft)
  return draft
}

function pushChunks(
  out: MedicalChunkDraft[],
  condition: NhsLocalizedCondition,
  sectionKey: string,
  titleSuffix: string,
  text: string,
  locale: string,
  opts: { pakistanNote?: boolean; splitBullets?: boolean } = {}
): void {
  const normalized = normalizeSectionText(text)
  let parts: string[]

  if (opts.splitBullets) {
    const bullets = splitBulletBlocks(normalized)
    parts =
      bullets.length > 1
        ? bullets.map((b) => (b.length > SYMPTOM_BULLET_MAX_CHARS ? splitLongText(b, SYMPTOM_BULLET_MAX_CHARS) : [b])).flat()
        : splitLongText(normalized, MAX_CHUNK_CHARS)
  } else {
    parts = splitLongText(normalized, MAX_CHUNK_CHARS)
  }

  for (const [i, part] of parts.entries()) {
    const draft = finalizeDraft({
      slug: `nhs-${condition.slug}-${sectionKey}${parts.length > 1 ? `-${i}` : ''}`,
      title: `${condition.condition_name} — ${titleSuffix}`,
      content: formatChunkBody(part, { pakistanNote: opts.pakistanNote }),
      source: 'nhs_uk',
      source_url: condition.source_url,
      condition_slug: condition.slug,
      section: sectionKey,
      locale,
      specialty_tags: [],
    })
    out.push(draft)
  }
}

export function conditionToChunks(condition: NhsLocalizedCondition): MedicalChunkDraft[] {
  const chunks: MedicalChunkDraft[] = []

  if (condition.emergency_advice_pakistan?.trim()) {
    pushChunks(
      chunks,
      condition,
      'emergency_advice_pakistan',
      'Emergency & urgent care (Pakistan)',
      condition.emergency_advice_pakistan,
      'en-PK',
      { pakistanNote: true }
    )
  }

  if (condition.localized_pakistan_context?.trim()) {
    const isShortContext =
      condition.localized_pakistan_context.length < 280 && !condition.emergency_advice_pakistan
    if (!isShortContext) {
      chunks.push(
        finalizeDraft({
          slug: `nhs-${condition.slug}-context`,
          title: `${condition.condition_name} — Pakistan context`,
          content: condition.localized_pakistan_context,
          source: 'nhs_uk',
          source_url: condition.source_url,
          condition_slug: condition.slug,
          section: 'localized_pakistan_context',
          locale: 'en-PK',
          specialty_tags: [],
        })
      )
    }
  }

  const s = condition.sections

  if (s.urgent_care?.trim()) {
    pushChunks(chunks, condition, 'urgent_care', 'When to seek urgent care', s.urgent_care, 'en-PK', {
      pakistanNote: true,
      splitBullets: true,
    })
  }
  if (s.emergency_care?.trim()) {
    pushChunks(chunks, condition, 'emergency_care', 'Emergency warning signs', s.emergency_care, 'en-PK', {
      pakistanNote: true,
      splitBullets: true,
    })
  }

  for (const { key, section, titleSuffix, locale, pakistanNote, splitBullets } of CLINICAL_SECTIONS) {
    if (key === 'emergency' || key === 'context' || key === 'urgent' || key === 'emergency_signs') continue
    const text = s[key as keyof typeof s]
    if (!text?.trim()) continue
    pushChunks(chunks, condition, section, titleSuffix, text, locale, { pakistanNote, splitBullets })
  }

  if (s.other?.trim()) {
    pushChunks(chunks, condition, 'other', 'Additional information', s.other, 'en-GB')
  }

  return chunks
}

export function buildAllChunksWithSharedEmergency(conditions: NhsLocalizedCondition[]): MedicalChunkDraft[] {
  const all: MedicalChunkDraft[] = []
  for (const c of conditions) {
    all.push(...conditionToChunks(c))
  }
  const shared = buildSharedPakistanEmergencyChunk()
  shared.embedding_text = buildEmbeddingText(shared)
  all.push(shared)
  return all
}
