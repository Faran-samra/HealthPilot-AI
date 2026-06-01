/** Paths relative to healthpilot-ai project root (run scripts from there). */

export const NHS_DATA = {
  root: 'data/nhs',
  urls: 'data/nhs/urls.json',
  structured: 'data/nhs/structured',
  localized: 'data/nhs/localized',
  chunks: 'data/nhs/chunks.json',
}

import { ensureDir } from './fs.ts'

export async function ensureNhsDirs(): Promise<void> {
  for (const dir of [NHS_DATA.root, NHS_DATA.structured, NHS_DATA.localized]) {
    await ensureDir(dir)
  }
}

export function parseLimit(args: string[]): number | null {
  const i = args.indexOf('--limit')
  if (i >= 0 && args[i + 1]) return parseInt(args[i + 1], 10)
  return null
}
