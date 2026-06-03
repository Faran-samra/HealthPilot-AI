/**
 * Merge approved/pending imports into draft doctors + source records.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { dedupeDoctorGroups, dedupeKey } from './lib/dedupe.ts'
import type { NormalizedDoctorRow } from './lib/normalize.ts'
import { isGarbageDoctorName } from './lib/sanitize.ts'
import { resolveDoctorMapPosition } from '../../src/utils/doctorLocationResolve.ts'

function coordsForRow(d: NormalizedDoctorRow): { latitude: number; longitude: number } | null {
  const pos = resolveDoctorMapPosition({
    latitude: d.latitude,
    longitude: d.longitude,
    city_slug: d.city_slug,
    city: d.city,
    area: d.area,
    address: d.address,
    hospital_name: d.hospital_name,
    clinic_name: d.clinic_name,
  })
  return { latitude: pos.lat, longitude: pos.lng }
}

export interface MergeOptions {
  /** Only merge rows with this review_status */
  reviewStatus?: 'pending' | 'approved'
  /** Auto-approve pending before merge (heuristic) */
  autoApprove?: boolean
  /** Publish to doctors table (draft vs published) */
  publish?: boolean
  limit?: number
}

export async function loadNormalizedFromImports(
  supabase: SupabaseClient,
  options: MergeOptions = {},
): Promise<{ rows: (NormalizedDoctorRow & { import_id: string })[]; ids: string[] }> {
  const status = options.reviewStatus ?? 'approved'
  const maxRows = options.limit ?? 50_000
  const pageSize = 1000
  const rows: (NormalizedDoctorRow & { import_id: string })[] = []
  const ids: string[] = []

  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const { data, error } = await supabase
      .from('doctor_import_raw')
      .select('id, source, source_url, normalized_payload, full_name, specialty_raw, city_raw, pmdc_number, payload')
      .eq('review_status', status)
      .is('published_doctor_id', null)
      .not('normalized_payload', 'is', null)
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    if (!data?.length) break

    for (const r of data) {
      const norm = r.normalized_payload as NormalizedDoctorRow | null
      if (!norm?.full_name || isGarbageDoctorName(norm.full_name)) continue
      rows.push({ ...norm, import_id: r.id })
      ids.push(r.id)
      if (rows.length >= maxRows) break
    }

    if (rows.length >= maxRows || data.length < pageSize) break
  }

  return { rows, ids }
}

export async function mergeImportsToDoctors(
  supabase: SupabaseClient,
  options: MergeOptions = {},
): Promise<{ merged: number; published: number; errors: number }> {
  if (options.autoApprove) {
    await supabase
      .from('doctor_import_raw')
      .update({ review_status: 'approved' })
      .eq('review_status', 'pending')
      .not('normalized_payload', 'is', null)
  }

  const { rows } = await loadNormalizedFromImports(supabase, {
    ...options,
    reviewStatus: options.reviewStatus ?? 'approved',
  })

  const importsByKey = new Map<string, string[]>()
  for (const r of rows) {
    const { import_id, ...norm } = r
    const k = dedupeKey(norm)
    const list = importsByKey.get(k) ?? []
    list.push(import_id)
    importsByKey.set(k, list)
  }

  const groups = dedupeDoctorGroups(rows.map(({ import_id: _importId, ...r }) => r))
  let merged = 0
  let published = 0
  let errors = 0

  for (const group of groups) {
    const d = group.merged
    const publication_status = options.publish ? 'published' : 'draft'
    const coords = coordsForRow(d)

    const row = {
      full_name: d.full_name,
      specialty: d.specialty,
      specialty_slug: d.specialty_slug,
      qualification: d.qualification ?? null,
      experience_years: d.experience_years ?? null,
      hospital_name: d.hospital_name ?? null,
      clinic_name: d.clinic_name ?? null,
      address: d.address ?? null,
      city: d.city,
      city_slug: d.city_slug,
      province: d.province ?? null,
      area: d.area ?? null,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      phone: d.phone ?? null,
      whatsapp: d.whatsapp ?? null,
      consultation_fee: d.consultation_fee ?? null,
      gender: d.gender ?? null,
      languages: d.languages ?? ['Urdu', 'English'],
      pmdc_number: d.pmdc_number ?? null,
      source: d.source,
      source_url: d.source_url ?? null,
      verification_status: d.verification_status,
      is_verified: d.is_verified,
      is_active: true,
      publication_status,
      source_count: group.sourceCount,
      profile_details: d.profile_details ?? {},
      available_days: d.available_days ?? null,
      available_times: d.available_times ?? null,
      updated_at: new Date().toISOString(),
    }

    let doc: { id: string } | null = null
    let error: { message: string } | null = null

    if (d.source_url) {
      const { data: existing } = await supabase
        .from('doctors')
        .select('id')
        .eq('source_url', d.source_url)
        .maybeSingle()

      if (existing?.id) {
        const res = await supabase.from('doctors').update(row).eq('id', existing.id).select('id').single()
        doc = res.data
        error = res.error
      }
    }

    if (!doc) {
      const res = await supabase
        .from('doctors')
        .insert({
          ...row,
          rating: 0,
          total_reviews: 0,
          accepts_online: false,
        })
        .select('id')
        .single()
      doc = res.data
      error = res.error
    }

    if (error || !doc) {
      errors++
      continue
    }

    merged++

    for (const srcRow of group.rows) {
      await supabase.from('doctor_source_records').upsert(
        {
          doctor_id: doc.id,
          source: srcRow.source,
          external_id: srcRow.source_url?.split('/').pop() ?? doc.id,
          source_url: srcRow.source_url,
        },
        { onConflict: 'source,external_id' },
      )
    }

    if (d.pmdc_number) {
      await supabase.rpc('queue_pmdc_verification', {
        p_doctor_id: doc.id,
        p_pmdc_number: d.pmdc_number,
        p_full_name: d.full_name,
      })
    }

    await supabase.rpc('recompute_doctor_verification', { p_doctor_id: doc.id })

    if (options.publish) published++

    for (const importId of importsByKey.get(group.key) ?? []) {
      await supabase
        .from('doctor_import_raw')
        .update({
          published_doctor_id: doc.id,
          review_status: 'published',
          merged_doctor_id: doc.id,
        })
        .eq('id', importId)
    }
  }

  return { merged, published, errors }
}
