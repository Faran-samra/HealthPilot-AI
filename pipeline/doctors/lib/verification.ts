import type { NormalizedDoctorRow, VerificationStatus } from './normalize.ts'

export interface SourceMatch {
  source: NormalizedDoctorRow['source']
  external_id?: string
  source_url?: string | null
}

/**
 * Compute verification status from PMDC flag and distinct source count.
 */
export function computeVerificationStatus(
  rows: NormalizedDoctorRow[],
  pmdcVerified = false,
  communityClaimed = false,
): VerificationStatus {
  if (communityClaimed) return 'community_verified'

  const sources = new Set(rows.map((r) => r.source))
  const hasPmdc = pmdcVerified || rows.some((r) => r.source === 'pmdc' || Boolean(r.pmdc_number))

  if (hasPmdc && sources.size >= 2) return 'cross_verified'
  if (hasPmdc) return 'verified'
  if (sources.size >= 2) return 'cross_verified'
  return 'unverified'
}

export function mergeVerification(
  a: VerificationStatus,
  b: VerificationStatus,
): VerificationStatus {
  const rank: Record<VerificationStatus, number> = {
    unverified: 0,
    verified: 1,
    cross_verified: 2,
    community_verified: 3,
  }
  return rank[a] >= rank[b] ? a : b
}
