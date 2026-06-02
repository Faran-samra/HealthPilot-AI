/**
 * Re-fetch Marham profiles: fix names, hospital, area, address, coordinates.
 *
 * Usage:
 *   npm run doctors:repair-marham -- --limit 500
 *   npm run doctors:repair-marham -- --all --limit 500
 */

import { createClient } from '@supabase/supabase-js'
import '../../../scripts/load-env.ts'
import { isGarbageDisplayText } from '../lib/sanitize.ts'
import { cleanWorkplaceName } from '../../../src/utils/doctorWorkplace.ts'
import { buildMarhamAvailability, mergePracticeTimings } from '../lib/marhamAvailability.ts'
import { MarhamConnector } from '../sources/marham/connector.ts'
import type { PracticeTimingRow } from '../lib/marhamAvailability.ts'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function needsProfileRepair(doc: {
  full_name: string
  specialty: string | null
  hospital_name: string | null
  area: string | null
}): boolean {
  if (isGarbageDisplayText(doc.specialty)) return true
  if (doc.specialty && /\s-\s.+?\s+at\s/i.test(doc.specialty)) return true
  if (/^dr\.?\s+(prof|asst|assoc)/i.test(doc.full_name)) return true
  if (!doc.hospital_name && !doc.area) return true
  if (doc.hospital_name && /\s-\s.+\s+at\s+/i.test(doc.hospital_name)) return true
  return false
}

async function main() {
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const limit = parseInt(arg('--limit') ?? '500', 10)
  const repairAll = process.argv.includes('--all')
  const supabase = createClient(url, key)
  const connector = new MarhamConnector(supabase)

  const { data: rows, error } = await supabase
    .from('doctors')
    .select(
      'id, source_url, full_name, specialty, specialty_slug, hospital_name, area, profile_details, available_times',
    )
    .eq('source', 'marham')
    .not('source_url', 'is', null)
    .limit(limit)

  if (error) throw error

  const finalFix = (rows ?? []).filter((d) => {
    if (repairAll) return true
    if (needsProfileRepair(d)) return true
    const pd = d.profile_details as { practice_timings?: unknown[] } | null
    return !pd?.practice_timings?.length
  })

  console.log(`[repair] re-fetching ${finalFix.length} Marham profiles`)

  let fixed = 0
  let failed = 0

  for (const doc of finalFix) {
    if (!doc.source_url) continue
    try {
      const result = await connector.fetchProfile(doc.source_url)
      if (!result.normalized || isGarbageDisplayText(result.normalized.specialty)) {
        const fallback = connector.parseProfileFromUrl(doc.source_url)
        if (fallback) result.normalized = fallback
      }

      const norm = result.normalized
      if (!norm) {
        failed++
        continue
      }

      const existingPd = doc.profile_details as { practice_timings?: PracticeTimingRow[] } | null
      const existingAt = doc.available_times as { practice_timings?: PracticeTimingRow[] } | null
      const mergedTimings = mergePracticeTimings(
        existingPd?.practice_timings ?? existingAt?.practice_timings,
        (norm.profile_details as { practice_timings?: PracticeTimingRow[] } | undefined)
          ?.practice_timings,
      )
      const availability = buildMarhamAvailability(norm.profile_details, mergedTimings)

      await supabase
        .from('doctors')
        .update({
          full_name: norm.full_name,
          specialty: norm.specialty,
          specialty_slug: norm.specialty_slug,
          hospital_name: cleanWorkplaceName(norm.hospital_name) ?? norm.hospital_name ?? null,
          clinic_name: cleanWorkplaceName(norm.clinic_name) ?? norm.clinic_name ?? null,
          area: norm.area ?? null,
          address: norm.address ?? null,
          city: norm.city,
          city_slug: norm.city_slug,
          province: norm.province ?? null,
          qualification: norm.qualification ?? null,
          consultation_fee: norm.consultation_fee ?? null,
          profile_details: availability.profile_details,
          latitude: norm.latitude ?? null,
          longitude: norm.longitude ?? null,
          gender: norm.gender ?? null,
          whatsapp: norm.whatsapp ?? null,
          available_days: availability.available_days,
          available_times: availability.available_times,
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.id)

      await supabase
        .from('doctor_import_raw')
        .update({
          normalized_payload: {
            ...norm,
            profile_details: availability.profile_details,
            available_times: availability.available_times,
            available_days: availability.available_days,
          },
        })
        .eq('source', 'marham')
        .eq('source_url', doc.source_url)

      fixed++
    } catch {
      failed++
    }
  }

  console.log(`[repair] fixed=${fixed} failed=${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
