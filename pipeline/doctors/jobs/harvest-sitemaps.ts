/**
 * Harvest doctor profile URLs from public sitemaps → doctor_import_raw (pending review).
 *
 * Usage: npm run doctors:harvest -- --source marham [--limit 500]
 */

import { createClient } from '@supabase/supabase-js'
import '../../../scripts/load-env.ts'
import { getConnector, SITEMAP_SOURCES } from '../sources/registry.ts'
import type { DoctorSource } from '../lib/normalize.ts'
import { HamariWebConnector } from '../sources/hamariweb/connector.ts'

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

  const source = (arg('--source') ?? 'marham') as DoctorSource
  const limit = parseInt(arg('--limit') ?? '1000', 10)

  if (!SITEMAP_SOURCES.includes(source)) {
    console.error(`Invalid source. Use: ${SITEMAP_SOURCES.join(', ')}`)
    process.exit(1)
  }

  const supabase = createClient(url, key)
  const connector = getConnector(source, supabase)

  console.log(`[harvest] source=${source} limit=${limit}`)

  let profileUrls: string[]

  if (source === 'hamariweb') {
    const hw = connector as HamariWebConnector
    const fromSitemap = await hw.harvestSitemapUrls(Math.min(limit, 2000))
    const fromListings = await hw.harvestFromListings(limit)
    profileUrls = [...new Set([...fromSitemap, ...fromListings])].slice(0, limit)
  } else {
    profileUrls = (await connector.harvestSitemapUrls(limit)).slice(0, limit)
  }

  console.log(`[harvest] found ${profileUrls.length} profile URLs`)

  const records = profileUrls.map((u) => connector.toRawImport(u))
  const { inserted, errors } = await connector.upsertRawImports(records)

  console.log(`[harvest] upserted=${inserted} errors=${errors}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
