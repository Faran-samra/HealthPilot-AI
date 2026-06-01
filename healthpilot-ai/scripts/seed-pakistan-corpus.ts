/**
 * Seed Pakistan guideline chunks into medical_chunks.
 * npm run corpus:seed-pk
 */
import './load-env.ts'
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)
const path = 'corpus/pakistan-guidelines/red-flags.md'
const content = await readFile(path, 'utf-8')
const slug = 'pk-red-flags'

const { error } = await supabase.from('medical_chunks').upsert(
  {
    slug,
    title: 'Pakistan health guidelines — red flags',
    content: `[Pakistan primary guidance]\n\n${content}`,
    source: 'pakistan',
    source_url: null,
    condition_slug: 'red-flags',
    section: 'emergency_advice_pakistan',
    locale: 'en-PK',
    specialty_tags: ['general', 'cardiology', 'pediatrics', 'gynecology'],
  },
  { onConflict: 'slug' }
)

if (error) console.error(error.message)
else console.log(`Upserted ${slug}`)
