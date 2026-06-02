/**
 * Clinic/hospital display names — strip Marham "Dr. X - Specialty at Venue" blobs.
 */

export function cleanWorkplaceName(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null

  let s = raw.trim().replace(/&amp;/g, '&').replace(/\s+/g, ' ')

  // "Dr. X - Specialty at Hospital" or "Lung Specialist at Masood Hospital"
  if (/\s+at\s+/i.test(s)) {
    const venue = s.match(/\s+at\s+(.+)$/i)?.[1]?.trim()
    if (
      venue &&
      venue.length >= 2 &&
      (/hospital|clinic|complex|centre|center|medical/i.test(venue) || venue.length < 55)
    ) {
      s = venue
    }
  }

  if (/^dr\.?\s.+\s-\s.+/i.test(s)) return null
  if (/\b(specialist|surgeon|physician|consultant)\s+at\s+/i.test(s)) {
    const venue = s.match(/\s+at\s+(.+)$/i)?.[1]?.trim()
    if (venue) s = venue
  }

  return s.length >= 2 ? s : null
}

export function getDisplayWorkplace(doctor: {
  hospital_name?: string | null
  clinic_name?: string | null
}): string | null {
  return (
    cleanWorkplaceName(doctor.hospital_name) ?? cleanWorkplaceName(doctor.clinic_name)
  )
}
