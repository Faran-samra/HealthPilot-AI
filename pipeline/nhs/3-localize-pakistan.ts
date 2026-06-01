/**
 * Step 3: Add Pakistan localization layer.
 * npx tsx pipeline/nhs/3-localize-pakistan.ts
 */
import { localizeCondition } from './lib/localize.ts'
import type { NhsStructuredCondition } from './lib/types.ts'
import { ensureNhsDirs, NHS_DATA } from './lib/paths.ts'
import { listJsonFiles, readText, writeText } from './lib/fs.ts'

await ensureNhsDirs()
const files = await listJsonFiles(NHS_DATA.structured)
console.log(`Localizing ${files.length} conditions...`)

for (const file of files) {
  const structured = JSON.parse(await readText(`${NHS_DATA.structured}/${file}`)) as NhsStructuredCondition
  const localized = localizeCondition(structured)
  await writeText(`${NHS_DATA.localized}/${file}`, JSON.stringify(localized, null, 2))
}

console.log(`Wrote ${files.length} files to ${NHS_DATA.localized}/`)
