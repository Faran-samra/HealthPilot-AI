export interface PracticeTimingRow {
  day: string
  start: string
  end: string
}

/** Keep profile_details + available_times in sync for Marham doctors. */
export function buildMarhamAvailability(
  profileDetails: Record<string, unknown> | undefined,
  practiceTimings: PracticeTimingRow[],
): {
  profile_details: Record<string, unknown>
  available_days: string[] | null
  available_times: { practice_timings: PracticeTimingRow[] } | null
} {
  const profile_details = {
    ...(profileDetails ?? {}),
    practice_timings: practiceTimings,
  }

  if (practiceTimings.length === 0) {
    return { profile_details, available_days: null, available_times: null }
  }

  return {
    profile_details,
    available_days: practiceTimings.map((t) => t.day),
    available_times: { practice_timings: practiceTimings },
  }
}

export function mergePracticeTimings(
  existing: PracticeTimingRow[] | undefined,
  parsed: PracticeTimingRow[] | undefined,
): PracticeTimingRow[] {
  if (parsed?.length) return parsed
  return existing ?? []
}
