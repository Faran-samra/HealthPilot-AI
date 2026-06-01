import pg from 'pg'
import fs from 'fs'

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

await client.connect()
const sql = fs.readFileSync('supabase/migrations/004_doctor_gender_phase6.sql', 'utf8')
await client.query(sql)
const result = await client.query('SELECT full_name, gender, accepts_online FROM doctors')
console.log(result.rows)
await client.end()
console.log('Migration 004 applied successfully')
