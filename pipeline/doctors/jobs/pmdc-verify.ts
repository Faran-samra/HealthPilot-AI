/**
 * Process PMDC verification queue batch.
 *
 * Usage: npm run doctors:pmdc-verify [--limit 50]
 */

import { createClient } from '@supabase/supabase-js'
import '../../../scripts/load-env.ts'
import { runPmdcVerificationBatch } from '../sources/pmdc/verifier.ts'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const limit = parseInt(arg('--limit') ?? '50', 10)
  const supabase = createClient(url, key)
  const result = await runPmdcVerificationBatch(supabase, limit)
  console.log(`[pmdc] processed=${result.processed} verified=${result.verified}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
