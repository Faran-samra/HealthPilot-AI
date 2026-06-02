/** Exclude legacy seed/demo doctors from public directory listings. */

const DEMO_SOURCES = new Set(['healthpilot', 'manual'])

export function isDirectoryListedDoctor(doctor: {
  source?: string | null
}): boolean {
  const src = (doctor.source ?? 'healthpilot').toLowerCase()
  return !DEMO_SOURCES.has(src)
}
