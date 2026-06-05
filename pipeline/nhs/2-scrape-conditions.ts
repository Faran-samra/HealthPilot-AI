/**
 * Step 2: Scrape and structure condition pages (no raw HTML stored).
 * npx tsx pipeline/nhs/2-scrape-conditions.ts --limit 5
 */
import { fetchAndExtract } from './lib/extract.ts'
import { sleep, writeText } from './lib/fs.ts'
import { ensureNhsDirs, NHS_DATA, parseLimit } from './lib/paths.ts'
import { exists } from './lib/fs.ts'
import { readText } from './lib/fs.ts'

const RATE_MS = 1200

await ensureNhsDirs()
if (!(await exists(NHS_DATA.urls))) {
  console.error(
    `Missing ${NHS_DATA.urls}\n` +
      'Run the sitemap step first:\n' +
      '  npm run nhs:sitemap\n' +
      'Then scrape:\n' +
      '  npm run nhs:scrape\n' +
      'Or test with 5 conditions:\n' +
      '  npm run nhs:sample'
  )
  process.exit(1)
}

const limit = parseLimit(process.argv.slice(2))
const { urls } = JSON.parse(await readText(NHS_DATA.urls)) as { urls: string[] }
const toScrape = limit ? urls.slice(0, limit) : urls

console.log(`Scraping ${toScrape.length} conditions (rate ${RATE_MS}ms)...`)

let ok = 0
let fail = 0

for (const url of toScrape) {
  const slug = url.replace(/\/$/, '').split('/').pop()!
  const outPath = `${NHS_DATA.structured}/${slug}.json`
  try {
    const data = await fetchAndExtract(url)
    await writeText(outPath, JSON.stringify(data, null, 2))
    ok++
    console.log(`  OK ${slug}`)
  } catch (e) {
    fail++
    console.error(`  FAIL ${slug}:`, e instanceof Error ? e.message : e)
  }
  await sleep(RATE_MS)
}

console.log(`Done. ok=${ok} fail=${fail}`)
