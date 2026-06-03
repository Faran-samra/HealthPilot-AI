const STORAGE_KEY = 'healthpilot.cityCounts'
const TTL_MS = 30 * 60 * 1000

export function readCachedCityCounts(): Map<string, number> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const { at, counts } = JSON.parse(raw) as { at: number; counts: Record<string, number> }
    if (Date.now() - at > TTL_MS) return null
    return new Map(Object.entries(counts))
  } catch {
    return null
  }
}

export function writeCachedCityCounts(counts: Map<string, number>): void {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        at: Date.now(),
        counts: Object.fromEntries(counts),
      })
    )
  } catch {
    /* ignore */
  }
}
