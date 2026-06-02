import type { NormalizedDoctorRow } from './normalize.ts'
import { computeVerificationStatus } from './verification.ts'

function normName(n: string): string {
  return n
    .toLowerCase()
    .replace(/^dr\.?\s*/i, '')
    .replace(/[^a-z0-9]/g, '')
}

function normHospital(h: string | null | undefined): string {
  return (h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24)
}

export function dedupeKey(row: NormalizedDoctorRow): string {
  if (row.pmdc_number) return `pmdc:${row.pmdc_number.trim().toLowerCase()}`
  return `name:${normName(row.full_name)}|city:${row.city_slug}|h:${normHospital(row.hospital_name ?? row.clinic_name)}`
}

export interface DedupeGroup {
  key: string
  rows: NormalizedDoctorRow[]
  merged: NormalizedDoctorRow
  sourceCount: number
}

function score(r: NormalizedDoctorRow): number {
  let s = 0
  if (r.pmdc_number) s += 100
  if (r.verification_status === 'verified') s += 50
  if (r.verification_status === 'cross_verified') s += 80
  if (r.verification_status === 'community_verified') s += 90
  if (r.phone) s += 10
  if (r.consultation_fee) s += 5
  if (r.source === 'pmdc') s += 40
  if (r.hospital_name || r.clinic_name) s += 8
  if (r.source_url) s += 3
  return s
}

function mergeRow(existing: NormalizedDoctorRow, row: NormalizedDoctorRow): NormalizedDoctorRow {
  const languages = [...new Set([...(existing.languages ?? []), ...(row.languages ?? [])])]
  return {
    ...existing,
    ...row,
    phone: row.phone ?? existing.phone,
    whatsapp: row.whatsapp ?? existing.whatsapp,
    consultation_fee: row.consultation_fee ?? existing.consultation_fee,
    pmdc_number: row.pmdc_number ?? existing.pmdc_number,
    hospital_name: row.hospital_name ?? existing.hospital_name,
    clinic_name: row.clinic_name ?? existing.clinic_name,
    area: row.area ?? existing.area,
    address: row.address ?? existing.address,
    qualification: row.qualification ?? existing.qualification,
    experience_years: row.experience_years ?? existing.experience_years,
    gender: row.gender ?? existing.gender,
    languages: languages.length ? languages : existing.languages,
    latitude: row.latitude ?? existing.latitude,
    longitude: row.longitude ?? existing.longitude,
    source_url: row.source_url ?? existing.source_url,
    is_verified: existing.is_verified || row.is_verified,
  }
}

/** Merge duplicate listings; track sources for cross_verified. */
export function dedupeDoctors(rows: NormalizedDoctorRow[]): NormalizedDoctorRow[] {
  return dedupeDoctorGroups(rows).map((g) => g.merged)
}

export function dedupeDoctorGroups(rows: NormalizedDoctorRow[]): DedupeGroup[] {
  const map = new Map<string, NormalizedDoctorRow[]>()

  for (const row of rows) {
    const key = dedupeKey(row)
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }

  const groups: DedupeGroup[] = []

  for (const [key, list] of map) {
    let merged = list[0]
    for (let i = 1; i < list.length; i++) {
      const candidate = list[i]
      if (score(candidate) > score(merged)) {
        merged = mergeRow(candidate, merged)
      } else {
        merged = mergeRow(merged, candidate)
      }
    }

    const sourceCount = new Set(list.map((r) => r.source)).size
    const verification_status = computeVerificationStatus(
      list,
      list.some((r) => r.pmdc_number && r.is_verified),
    )

    groups.push({
      key,
      rows: list,
      merged: {
        ...merged,
        verification_status,
        is_verified: verification_status !== 'unverified',
      },
      sourceCount,
    })
  }

  return groups
}
