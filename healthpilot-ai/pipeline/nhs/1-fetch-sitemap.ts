/**
 * Step 1: Fetch NHS condition URLs from sitemap.
 * npx tsx pipeline/nhs/1-fetch-sitemap.ts
 */
import { fetchConditionUrls } from './lib/sitemap.ts'
import { ensureNhsDirs, NHS_DATA } from './lib/paths.ts'
import { writeText } from './lib/fs.ts'

await ensureNhsDirs()
console.log('Fetching NHS sitemap...')
const urls = await fetchConditionUrls()
await writeText(
  NHS_DATA.urls,
  JSON.stringify({ fetched_at: new Date().toISOString(), count: urls.length, urls }, null, 2)
)
console.log(`Saved ${urls.length} condition URLs to ${NHS_DATA.urls}`)
