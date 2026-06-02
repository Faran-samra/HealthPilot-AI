/**
 * Import doctors from CSV into Supabase `doctors` table.
 * Template: scripts/doctors-import-template.csv
 *
 * Usage: npm run doctors:import -- path/to/file.csv
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import '../../scripts/load-env.ts'
import { dedupeDoctors } from './lib/dedupe.ts'
import {
  normalizeCitySlug,
  normalizeDoctorName,
  normalizeSpecialty,
  parseFee,
  type NormalizedDoctorRow,
} from './lib/normalize.ts'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const file = process.argv[2] ?? 'scripts/doctors-import-template.csv'
const raw = readFileSync(file, 'utf8')
const lines = raw.split(/\r?\n/).filter(Boolean)
const headers = lines[0].split(',').map((h) => h.trim())

function rowToObject(cells: string[]): Record<string, string> {
  const o: Record<string, string> = {}
  headers.forEach((h, i) => {
    o[h] = (cells[i] ?? '').trim()
  })
  return o
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') inQ = !inQ
    else if (c === ',' && !inQ) {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out
}

const rows: NormalizedDoctorRow[] = []

for (let i = 1; i < lines.length; i++) {
  const o = rowToObject(parseCsvLine(lines[i]))
  if (!o.full_name) continue
  const { slug, label } = normalizeSpecialty(o.specialty_slug || o.specialty)
  const citySlug = normalizeCitySlug(o.city_slug || o.city)
  rows.push({
    full_name: normalizeDoctorName(o.full_name),
    specialty: label,
    specialty_slug: slug,
    qualification: o.qualification || null,
    experience_years: o.experience_years ? parseInt(o.experience_years, 10) : null,
    hospital_name: o.hospital_name || null,
    clinic_name: o.clinic_name || null,
    address: o.address || null,
    city: o.city || citySlug,
    city_slug: citySlug,
    province: o.province || null,
    area: o.area || null,
    latitude: o.latitude ? parseFloat(o.latitude) : null,
    longitude: o.longitude ? parseFloat(o.longitude) : null,
    phone: o.phone || null,
    whatsapp: o.whatsapp || o.phone || null,
    consultation_fee: parseFee(o.consultation_fee),
    gender: o.gender === 'female' ? 'female' : o.gender === 'male' ? 'male' : null,
    languages: o.languages ? o.languages.split(/[|;]/).map((s) => s.trim()) : ['Urdu', 'English'],
    pmdc_number: o.pmdc_number || null,
    source: (o.source as NormalizedDoctorRow['source']) || 'manual',
    source_url: o.source_url || null,
    verification_status: o.pmdc_number && o.is_verified === 'true' ? 'verified' : 'unverified',
    is_verified: o.is_verified === 'true' || Boolean(o.pmdc_number),
  })
}

const merged = dedupeDoctors(rows)
const supabase = createClient(url, key)

let ok = 0
let err = 0

for (const d of merged) {
  const { error } = await supabase.from('doctors').upsert(
    {
      ...d,
      is_active: true,
      rating: 0,
      total_reviews: 0,
      accepts_online: false,
    },
    { onConflict: 'pmdc_number', ignoreDuplicates: false },
  )

  if (error) {
    const { error: e2 } = await supabase.from('doctors').insert({
      ...d,
      is_active: true,
      rating: 0,
      total_reviews: 0,
      accepts_online: false,
    })
    if (e2) {
      console.warn('Skip:', d.full_name, e2.message)
      err++
    } else ok++
  } else ok++
}

console.log(`Imported ${ok} doctors (${err} skipped) from ${file}`)
