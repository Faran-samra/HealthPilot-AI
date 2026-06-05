/**
 * Clear embeddings on NHS chunks so npm run nhs:embed rebuilds vectors after content changes.
 * npm run nhs:reembed
 */
import '../../scripts/load-env.ts'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

const { data, error } = await supabase
  .from('medical_chunks')
  .update({ embedding: null })
  .eq('source', 'nhs_uk')
  .select('id')

if (error) {
  console.error(error.message)
  process.exit(1)
}

console.log(`Cleared embeddings on ${data?.length ?? 0} NHS chunks. Run: npm run nhs:embed`)
