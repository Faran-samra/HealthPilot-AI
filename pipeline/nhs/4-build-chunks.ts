/**
 * Step 4: Build chunk manifest.
 * npx tsx pipeline/nhs/4-build-chunks.ts
 */
import { conditionToChunks } from './lib/chunk.ts'
import type { NhsLocalizedCondition } from './lib/types.ts'
import { ensureNhsDirs, NHS_DATA } from './lib/paths.ts'
import { listJsonFiles, readText, writeText } from './lib/fs.ts'

await ensureNhsDirs()
const files = await listJsonFiles(NHS_DATA.localized)
const allChunks = []

for (const file of files) {
  const condition = JSON.parse(await readText(`${NHS_DATA.localized}/${file}`)) as NhsLocalizedCondition
  allChunks.push(...conditionToChunks(condition))
}

await writeText(
  NHS_DATA.chunks,
  JSON.stringify({ built_at: new Date().toISOString(), count: allChunks.length, chunks: allChunks }, null, 2)
)
console.log(`Built ${allChunks.length} chunks → ${NHS_DATA.chunks}`)
