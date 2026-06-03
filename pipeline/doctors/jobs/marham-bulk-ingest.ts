/**
 * End-to-end Marham ingest: harvest → parallel fetch → review → merge → optional backfills.
 *
 * Usage:
 *   npm run doctors:marham-ingest -- --harvest-limit 6000 --fetch-batch 400 --rounds 20
 *   npm run doctors:marham-ingest -- --harvest-limit 8000 --fetch-batch 500 --concurrency 8 --rps 4 --publish
 *
 * Env (optional): MARHAM_RPS=4  MARHAM_FETCH_CONCURRENCY=8
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../../..')

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function runNpm(script: string, extraArgs: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['run', script, '--', ...extraArgs],
      { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' },
    )
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${script} exited with code ${code}`))
    })
  })
}

async function main() {
  const harvestLimit = arg('--harvest-limit') ?? '6000'
  const fetchBatch = arg('--fetch-batch') ?? '400'
  const rounds = parseInt(arg('--rounds') ?? '20', 10)
  const concurrency = arg('--concurrency') ?? process.env.MARHAM_FETCH_CONCURRENCY ?? '8'
  const rps = arg('--rps') ?? process.env.MARHAM_RPS ?? '4'
  const publish = hasFlag('--publish')
  const skipHarvest = hasFlag('--skip-harvest')
  const skipBackfill = hasFlag('--skip-backfill')

  console.log('[marham-ingest] starting', {
    harvestLimit,
    fetchBatch,
    rounds,
    concurrency,
    rps,
    publish,
  })

  if (!skipHarvest) {
    console.log('\n=== 1/6 Harvest URLs (sitemaps + city listings) ===')
    await runNpm('doctors:harvest', ['--source', 'marham', '--limit', harvestLimit, '--rps', rps])
  }

  for (let i = 1; i <= rounds; i++) {
    console.log(`\n=== 2/6 Fetch profiles (round ${i}/${rounds}) ===`)
    await runNpm('doctors:fetch', [
      '--source',
      'marham',
      '--limit',
      fetchBatch,
      '--concurrency',
      concurrency,
      '--rps',
      rps,
    ])
  }

  console.log('\n=== 3/6 Auto-review ===')
  await runNpm('doctors:review', ['--limit', harvestLimit])

  console.log('\n=== 4/6 Merge to doctors table ===')
  const mergeArgs = ['--auto-approve', '--limit', harvestLimit]
  if (publish) mergeArgs.push('--publish')
  await runNpm('doctors:merge', mergeArgs)

  if (!skipBackfill) {
    console.log('\n=== 5/6 Backfill cities & locations ===')
    await runNpm('doctors:backfill-cities', [])
    await runNpm('doctors:backfill-locations', [])

    console.log('\n=== 6/7 Backfill fees (correct Area-band prices) ===')
    await runNpm('doctors:backfill-fees', ['--limit', harvestLimit])

    console.log('\n=== 7/7 Repair bad Marham rows (names/cities from URL path) ===')
    await runNpm('doctors:repair-marham', ['--', '--all', '--limit', harvestLimit])
  }

  console.log('\n[marham-ingest] done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
