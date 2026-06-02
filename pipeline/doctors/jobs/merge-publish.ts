/**
 * Merge approved imports → doctors (draft or published).
 *
 * Usage: npm run doctors:merge [--publish] [--auto-approve] [--limit 200]
 *
 * Note: merge only includes review_status=approved unless --auto-approve is passed.
 * Run `npm run doctors:review` first, or use --auto-approve after fetch.
 */

import { createClient } from '@supabase/supabase-js'
import '../../../scripts/load-env.ts'
import { mergeImportsToDoctors } from '../merge-pipeline.ts'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

function arg(name: string): boolean {
  return process.argv.includes(name)
}

function argVal(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, key)
  const publish = arg('--publish')
  const autoApprove = arg('--auto-approve')
  const limit = parseInt(argVal('--limit') ?? '200', 10)

  if (!autoApprove) {
    const { count: approved } = await supabase
      .from('doctor_import_raw')
      .select('*', { count: 'exact', head: true })
      .eq('review_status', 'approved')
      .is('published_doctor_id', null)
      .not('normalized_payload', 'is', null)

    const { count: pending } = await supabase
      .from('doctor_import_raw')
      .select('*', { count: 'exact', head: true })
      .eq('review_status', 'pending')
      .is('published_doctor_id', null)
      .not('normalized_payload', 'is', null)

    if ((approved ?? 0) === 0 && (pending ?? 0) > 0) {
      console.warn(
        `[merge] ${pending} fetched row(s) still pending review. Run: npm run doctors:review -- --limit ${limit}\n` +
          `       Or merge with: npm run doctors:merge -- --auto-approve${publish ? ' --publish' : ''} -- --limit ${limit}`,
      )
    }
  }

  const eligibleQuery = supabase
    .from('doctor_import_raw')
    .select('*', { count: 'exact', head: true })
    .eq('review_status', 'approved')
    .is('published_doctor_id', null)
    .not('normalized_payload', 'is', null)

  if (autoApprove) {
    const { count: pendingEligible } = await supabase
      .from('doctor_import_raw')
      .select('*', { count: 'exact', head: true })
      .eq('review_status', 'pending')
      .is('published_doctor_id', null)
      .not('normalized_payload', 'is', null)
    if ((pendingEligible ?? 0) > 0) {
      console.log(`[merge] will auto-approve up to ${limit} pending row(s) before merge`)
    }
  }

  const { count: eligible } = await eligibleQuery
  const { count: alreadyPublished } = await supabase
    .from('doctor_import_raw')
    .select('*', { count: 'exact', head: true })
    .not('published_doctor_id', 'is', null)

  const result = await mergeImportsToDoctors(supabase, {
    reviewStatus: 'approved',
    autoApprove,
    publish,
    limit,
  })

  console.log(`[merge] merged=${result.merged} published=${result.published} errors=${result.errors}`)

  if (result.merged === 0) {
    if ((eligible ?? 0) === 0 && (alreadyPublished ?? 0) > 0) {
      console.log(
        `[merge] nothing to do — ${alreadyPublished} import(s) already published. Harvest/fetch a new batch to add more doctors.`,
      )
    } else if ((eligible ?? 0) === 0) {
      console.log('[merge] no eligible rows (approved + normalized + not yet published). Run fetch/review first.')
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
