/** Marham online booking uses /callcenter on the doctor profile URL (not the shared WhatsApp bot). */

const MARHAM_HOST = 'marham.pk'

export function isMarhamDoctor(doctor: { source?: string | null }): boolean {
  return doctor.source === 'marham'
}

/**
 * Official Marham appointment page (clinic, slot, phone, OTP).
 * @see https://www.marham.pk/doctors/lahore/dermatologist/dr-tariq-niaz-butt/callcenter
 */
export function getMarhamCallcenterUrl(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl?.trim()) return null
  try {
    const url = new URL(sourceUrl.trim())
    if (!url.hostname.replace(/^www\./, '').endsWith(MARHAM_HOST)) return null
    if (!url.pathname.includes('/doctors/')) return null

    let path = url.pathname.replace(/\/+$/, '')
    if (path.endsWith('/callcenter')) return url.toString()

    const segments = path.split('/').filter(Boolean)
    // Profile URLs: /doctors/{city}/{specialty}/{slug}
    if (segments.length < 4 || segments[0] !== 'doctors') return null
    if (segments[1]?.startsWith('area-')) return null

    path = `${path}/callcenter`
    url.pathname = path
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}
