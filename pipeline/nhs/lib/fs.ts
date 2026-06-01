import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

export async function readText(path: string): Promise<string> {
  return readFile(path, 'utf-8')
}

export async function writeText(path: string, content: string): Promise<void> {
  await writeFile(path, content, 'utf-8')
}

export async function listJsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  return entries.filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => e.name)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
