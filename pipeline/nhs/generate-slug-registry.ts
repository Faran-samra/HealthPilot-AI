/**
 * Build NHS condition slug registry for RAG slug inference.
 * npx tsx pipeline/nhs/generate-slug-registry.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CSV = path.join(ROOT, 'nhs_conditions_rows.csv')
const OUT = path.join(ROOT, 'supabase/functions/_shared/nhs-slug-registry.ts')

interface Entry {
  slug: string
  name: string
}

function parseCsvRows(raw: string): Entry[] {
  const lines = raw.split(/\r?\n/).filter(Boolean)
  const entries: Entry[] = []
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i].match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12},([^,]+),([^,]+),https:\/\//
    )
    if (!m) continue
    const slug = m[1].trim()
    const name = m[2].trim().replace(/^Overview\s*-\s*/i, '')
    if (slug && name) entries.push({ slug, name })
  }
  return entries
}

const entries = parseCsvRows(readFileSync(CSV, 'utf8'))
entries.sort((a, b) => a.slug.localeCompare(b.slug))

const body = `/**
 * NHS condition slug registry for RAG — auto-generated from nhs_conditions_rows.csv
 * Regenerate: npx tsx pipeline/nhs/generate-slug-registry.ts
 */
export interface NhsSlugEntry {
  slug: string
  name: string
}

export const NHS_CONDITION_REGISTRY: readonly NhsSlugEntry[] = ${JSON.stringify(entries, null, 2)} as const
`

writeFileSync(OUT, body, 'utf8')
console.log(`Wrote ${entries.length} conditions → ${OUT}`)
