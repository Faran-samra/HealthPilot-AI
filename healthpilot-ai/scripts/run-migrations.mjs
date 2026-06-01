import pg from 'pg'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('Set DATABASE_URL environment variable to run migrations.')
  process.exit(1)
}

const migrations = [
  '001_initial_schema.sql',
  '002_specialties_seed.sql',
  '003_postgis_functions.sql',
  '004_doctor_gender_phase6.sql',
  '005_realtime_appointments.sql',
  '006_nationwide_location.sql',
]

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  await client.connect()
  console.log('Connected to Supabase PostgreSQL')

  for (const file of migrations) {
    const sql = readFileSync(join(root, 'supabase', 'migrations', file), 'utf8')
    console.log(`\nRunning ${file}...`)
    try {
      await client.query(sql)
      console.log(`✓ ${file} completed`)
    } catch (err) {
      if (err.message?.includes('already exists')) {
        console.log(`⚠ ${file} skipped (already applied): ${err.message.split('\n')[0]}`)
      } else {
        throw err
      }
    }
  }

  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)
  console.log('\nPublic tables:', tables.rows.map((r) => r.table_name).join(', '))

  const doctors = await client.query('SELECT COUNT(*) FROM doctors')
  const specialties = await client.query('SELECT COUNT(*) FROM specialties')
  console.log(`Doctors seeded: ${doctors.rows[0].count}`)
  console.log(`Specialties seeded: ${specialties.rows[0].count}`)

  await client.end()
  console.log('\nAll migrations done.')
}

run().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
