/** Persist Find Doctors filters so back navigation keeps city/specialty. */

const STORAGE_KEY = 'healthpilot.doctorsListSearch'
const SCROLL_KEY = 'healthpilot.doctorsListScroll'

const LIST_PARAM_KEYS = [
  'city',
  'area',
  'specialty',
  'name',
  'maxFee',
  'minFee',
  'female',
  'male',
  'language',
  'nearMe',
] as const

export function getStoredDoctorsListSearch(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function persistDoctorsListSearch(params: URLSearchParams): void {
  try {
    const copy = new URLSearchParams()
    for (const key of LIST_PARAM_KEYS) {
      const v = params.get(key)
      if (v) copy.set(key, v)
    }
    const q = copy.toString()
    if (q) sessionStorage.setItem(STORAGE_KEY, q)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore private mode */
  }
}

export function doctorsListPath(listQuery?: string | URLSearchParams): string {
  const q =
    typeof listQuery === 'string'
      ? listQuery
      : listQuery?.toString() || getStoredDoctorsListSearch()
  return q ? `/doctors?${q}` : '/doctors'
}

export function doctorDetailPath(doctorId: string, listQuery?: string | URLSearchParams): string {
  const q =
    typeof listQuery === 'string'
      ? listQuery
      : listQuery?.toString() || getStoredDoctorsListSearch()
  return q ? `/doctors/${doctorId}?${q}` : `/doctors/${doctorId}`
}

export function bookAppointmentPath(doctorId: string, listQuery?: string | URLSearchParams): string {
  const q =
    typeof listQuery === 'string'
      ? listQuery
      : listQuery?.toString() || getStoredDoctorsListSearch()
  return q ? `/doctors/${doctorId}/book?${q}` : `/doctors/${doctorId}/book`
}

/** City from stored list search (when URL has no ?city=). */
export function storedListCitySlug(): string | null {
  const q = getStoredDoctorsListSearch()
  if (!q) return null
  return new URLSearchParams(q).get('city')
}

/** Remember scroll position when opening a doctor profile. */
export function saveDirectoryListScroll(): void {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
  } catch {
    /* ignore */
  }
}

export function readDirectoryListScroll(): number | null {
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY)
    if (raw == null) return null
    const y = Number(raw)
    return Number.isFinite(y) ? y : null
  } catch {
    return null
  }
}

export function clearDirectoryListScroll(): void {
  try {
    sessionStorage.removeItem(SCROLL_KEY)
  } catch {
    /* ignore */
  }
}
