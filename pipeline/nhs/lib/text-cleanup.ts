/**
 * Normalize scraped NHS section text: lists, dedupe, fix glued list items.
 */

/** Insert missing spaces where list items were concatenated during scrape. */
export function fixGluedListItems(text: string): string {
  return (
    text
      .replace(/\bover(smoke|used)\b/gi, 'over $1')
      .replace(/(pressure|cholesterol|syndrome|disease|infection|anaemia)(have|has|are|is)\b/gi, '$1 $2')
      .replace(/([a-z]{4,})(have|has|are|smoke|used|with|your|the)\b/gi, '$1 $2')
      .replace(/([a-z])(a\s+pulsing)/gi, '$1. $2')
      .replace(/(pain)(a\s+)/gi, '$1. $2')
      .replace(/(bigger)(surgery)/gi, '$1 $2')
      .replace(/(level,)(which)/gi, '$1 $2')
      .replace(/(pill)(rarely)/gi, '$1 $2')
      .replace(/(parents)(Sometimes)/g, '$1. $2')
      .replace(/(skin)(Sometimes)/g, '$1. $2')
      .replace(/\)(have|has|are|is)\b/gi, ') $1')
      .replace(/(smaller)(medium)/gi, '$1; $2')
      .replace(/(bigger)( Screening)/g, '$1.$2')
  )
}

/** Turn inline "if you: item item item" risk lists into bullets when no list markup was scraped. */
export function formatInlineRiskLists(text: string): string {
  const m = text.match(/(.{0,120}more at risk if you:)\s*(.+)$/is)
  if (!m) return text
  const prefix = m[1]
  const rest = m[2]
  const items = fixGluedListItems(rest)
    .split(/\s+(?=have |are |is |smoke|used to|aged |male |female )/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
  if (items.length < 3) return text
  return `${prefix}\n\n${items.map((i) => `- ${i}`).join('\n')}`
}

export function dedupeParagraphs(text: string): string {
  const paras = text.split(/\n\n+/)
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of paras) {
    const trimmed = p.trim()
    if (!trimmed) continue
    const key = trimmed.replace(/\s+/g, ' ').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out.join('\n\n')
}

/** Strip duplicate section heading line at start of body (heading already stored separately). */
export function stripRedundantHeading(body: string, heading: string): string {
  const h = heading.trim().toLowerCase()
  const first = body.split('\n\n')[0]?.trim().toLowerCase() ?? ''
  if (first === h || first.startsWith(h.slice(0, 20))) {
    return body.split('\n\n').slice(1).join('\n\n').trim() || body
  }
  return body
}

export function normalizeSectionText(text: string): string {
  let out = text.replace(/\r\n/g, '\n').trim()
  out = fixGluedListItems(out)
  out = formatInlineRiskLists(out)
  out = dedupeParagraphs(out)
  return out.replace(/\n{3,}/g, '\n\n').trim()
}

/** Split bullet lines (- item) into separate symptom-sized blocks when enough bullets exist. */
export function splitBulletBlocks(text: string, minBullets = 2): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const bullets = lines.filter((l) => l.startsWith('- '))
  if (bullets.length < minBullets) return [text]

  const header = lines.filter((l) => !l.startsWith('- ')).join('\n\n')
  return bullets.map((b) => (header ? `${header}\n\n${b}` : b))
}
