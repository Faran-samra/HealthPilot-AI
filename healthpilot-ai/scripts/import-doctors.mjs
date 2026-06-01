/**
 * Bulk import doctors from CSV into Supabase.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/import-doctors.mjs doctors.csv
 *
 * CSV columns (header row required):
 *   full_name,specialty,specialty_slug,qualification,experience_years,
 *   hospital_name,address,city,city_slug,province,area,latitude,longitude,
 *   phone,whatsapp,consultation_fee,gender,accepts_online,pmdc_number,is_verified
 *
 * PostGIS `location` is auto-synced by the DB trigger from latitude/longitude.
 */
import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const connectionString = process.env.DATABASE_URL
const csvPath = process.argv[2]

if (!connectionString || !csvPath) {
  console.error('Usage: DATABASE_URL=... node scripts/import-doctors.mjs <path-to.csv>')
  process.exit(1)
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim())
    const row = {}
    headers.forEach((h, i) => {
      row[h] = values[i] ?? ''
    })
    return row
  })
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

const rows = parseCsv(readFileSync(resolve(csvPath), 'utf8'))
let inserted = 0
let skipped = 0

for (const row of rows) {
  const existing = await client.query(
    'SELECT id FROM doctors WHERE full_name = $1 AND city_slug = $2 LIMIT 1',
    [row.full_name, row.city_slug?.toLowerCase()]
  )

  if (existing.rows.length > 0) {
    skipped++
    continue
  }

  await client.query(
    `INSERT INTO doctors (
      full_name, specialty, specialty_slug, qualification, experience_years,
      hospital_name, address, city, city_slug, province, area,
      latitude, longitude, phone, whatsapp, consultation_fee,
      gender, accepts_online, pmdc_number, is_verified, is_active,
      available_days, available_times, rating, total_reviews
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,TRUE,
      ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
      '{"start":"09:00","end":"17:00"}'::jsonb, 0, 0
    )`,
    [
      row.full_name,
      row.specialty,
      row.specialty_slug,
      row.qualification || null,
      row.experience_years ? Number(row.experience_years) : null,
      row.hospital_name || null,
      row.address || null,
      row.city,
      row.city_slug?.toLowerCase() || row.city?.toLowerCase(),
      row.province || null,
      row.area || null,
      row.latitude ? Number(row.latitude) : null,
      row.longitude ? Number(row.longitude) : null,
      row.phone || null,
      row.whatsapp || null,
      row.consultation_fee ? Number(row.consultation_fee) : null,
      row.gender || null,
      row.accepts_online === 'true' || row.accepts_online === '1',
      row.pmdc_number || null,
      row.is_verified === 'true' || row.is_verified === '1',
    ]
  )
  inserted++
}

const count = await client.query('SELECT COUNT(*) FROM doctors WHERE is_active = TRUE')
await client.end()

console.log(`Import complete: ${inserted} inserted, ${skipped} skipped (duplicates)`)
console.log(`Total active doctors in DB: ${count.rows[0].count}`)
