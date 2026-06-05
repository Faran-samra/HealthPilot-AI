/**
 * Step 4: Build chunk manifest.
 * npx tsx pipeline/nhs/4-build-chunks.ts
 */
import { buildAllChunksWithSharedEmergency } from './lib/chunk.ts'
import type { NhsLocalizedCondition } from './lib/types.ts'
import { SHARED_PAKISTAN_EMERGENCY_SLUG } from './lib/chunk-meta.ts'
import { ensureNhsDirs, NHS_DATA } from './lib/paths.ts'
import { listJsonFiles, readText, writeText } from './lib/fs.ts'

await ensureNhsDirs()
const files = await listJsonFiles(NHS_DATA.localized)
const conditions: NhsLocalizedCondition[] = []

for (const file of files) {
  conditions.push(JSON.parse(await readText(`${NHS_DATA.localized}/${file}`)) as NhsLocalizedCondition)
}

const allChunks = buildAllChunksWithSharedEmergency(conditions)

await writeText(
  NHS_DATA.chunks,
  JSON.stringify({ built_at: new Date().toISOString(), count: allChunks.length, chunks: allChunks }, null, 2)
)
console.log(
  `Built ${allChunks.length} chunks (incl. shared ${SHARED_PAKISTAN_EMERGENCY_SLUG}) → ${NHS_DATA.chunks}`
)
