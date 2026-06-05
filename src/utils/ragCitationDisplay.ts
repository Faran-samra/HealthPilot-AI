import type { RagSourceCitation } from '@/types/symptomChat'

const SECTION_LABELS: Record<string, string> = {
  symptoms: 'Symptoms',
  overview: 'Overview',
  treatment: 'Treatment',
  self_care: 'Self-care',
  prevention: 'Prevention',
  complications: 'Complications',
  causes: 'Causes',
  diagnosis: 'Diagnosis',
  when_to_seek_help: 'When to seek help',
  emergency_care: 'Emergency care',
  urgent_care: 'Urgent care',
  emergency_advice_pakistan: 'Emergency advice (Pakistan)',
  localized_pakistan_context: 'Pakistan health context',
}

function humanizeSection(section: string | null): string | null {
  if (!section) return null
  const key = section.trim().toLowerCase()
  if (SECTION_LABELS[key]) return SECTION_LABELS[key]
  return key
    .replace(/_/g, ' ')
    .replace(/\bpakistan\b/gi, 'Pakistan')
    .replace(/\buk\b/gi, 'UK')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Short badge for source origin — no internal keys. */
export function formatRagSourceBadge(source: string): string {
  if (/pakistan/i.test(source)) return 'Pakistan guidelines'
  if (/nhs/i.test(source)) return 'NHS reference'
  return source
}

/** Primary line: condition title, trimmed of redundant section suffix. */
export function formatRagCitationTitle(src: RagSourceCitation): string {
  const title = src.title?.trim() ?? 'Medical reference'
  const sectionLabel = humanizeSection(src.section)
  if (!sectionLabel) return title

  const parts = title.split(' — ')
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]?.trim() ?? ''
    if (last.toLowerCase() === sectionLabel.toLowerCase()) {
      return parts.slice(0, -1).join(' — ').trim()
    }
  }

  return title
}

/** Secondary line: section + source badge. */
export function formatRagCitationSubtitle(src: RagSourceCitation): string {
  const sectionLabel = humanizeSection(src.section)
  const badge = formatRagSourceBadge(src.source)
  if (sectionLabel && !src.title?.includes(sectionLabel)) {
    return `${sectionLabel} · ${badge}`
  }
  return badge
}

/** Deduplicate near-identical citations for cleaner UI. */
export function dedupeRagSources(sources: RagSourceCitation[]): RagSourceCitation[] {
  const seen = new Set<string>()
  const out: RagSourceCitation[] = []
  for (const src of sources) {
    const key = `${formatRagCitationTitle(src)}|${src.section ?? ''}|${formatRagSourceBadge(src.source)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(src)
  }
  return out
}
