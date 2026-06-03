import fs from 'fs'

const lines = fs.readFileSync('doctors_rows.csv', 'utf8').split(/\r?\n/)
let total = 0
const bad = {}
const badRows = []

/** Slugs that are URL tokens, not real specialties (do not include gastroenterologist etc.) */
const badSpecialty = new Set([
  'dr', 'area', 'prof', 'assoc', 'asst', 'pediatric', 'general', 'neuro', 'aqsa',
  'breast', 'renal', 'alternative', 'fazl', '18', 'waqar', 'zaheer', 'moti', 'ms',
])

const garbageWords =
  /^(dr|area|assoc|prof|asst|general|pediatric|neuro|gastroenterologist|nephrologist|anesthetist|counselor|physiotherapist|nutritionist|surgeon|physician|breast|renal|alternative)$/i

function parseLine(line) {
  const p = []
  let cur = ''
  let inQ = false
  for (const c of line) {
    if (c === '"') {
      inQ = !inQ
      continue
    }
    if (c === ',' && !inQ) {
      p.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  p.push(cur)
  return p
}

function isListingUrl(url) {
  const m = url.match(/marham\.pk\/doctors\/([^?#]+)/i)
  if (!m) return false
  const parts = m[1].split('/').filter(Boolean)
  if (parts.length < 3) return true
  const last = parts[parts.length - 1]
  if (last.startsWith('dr-') || last.startsWith('prof-') || last.startsWith('assoc-') || last.startsWith('asst-')) {
    return false
  }
  if (last.startsWith('area-')) return true
  if (parts.length === 2) return true
  if (parts.length === 3 && !last.includes('-')) return false
  if (parts.length === 3 && /-(surgeon|physician|dentist|gastroenterologist|nephrologist|psychiatrist|endocrinologist|counselor|anesthetist|specialist)$/.test(last)) {
    return true
  }
  return false
}

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue
  total++
  const p = parseLine(lines[i])
  const name = p[1] ?? ''
  const slug = p[3] ?? ''
  const url = p[32] ?? ''
  const reason = []

  if (!name.trim() || name.trim().length < 4) reason.push('short_name')
  if (/^dr\.?\s+dr\.?\s*$/i.test(name)) reason.push('dr_dr')
  if (/^(asst|assoc)\s+prof\.?$/i.test(name)) reason.push('title_only')
  if (/^\d+\s+best\b/i.test(name) || /\bbest\b.+\bin\b/i.test(name)) reason.push('listing_title')
  const stripped = name.replace(/^dr\.?\s+/i, '').trim()
  if (garbageWords.test(stripped) || garbageWords.test(name.trim())) reason.push('garbage_word')
  const wo = name.replace(/^(?:(?:asst|assoc)\.?\s+)?(?:(?:dr|prof)\.?\s+)+/gi, '').trim()
  if (wo.length < 2) reason.push('no_real_name')
  if (badSpecialty.has(slug)) reason.push('bad_specialty_slug')
  if (url && isListingUrl(url)) reason.push('listing_url')
  if (name.toLowerCase().startsWith('dr. area')) reason.push('area_listing')

  if (reason.length) {
    badRows.push({ name, slug, url: url.slice(0, 90), reason: [...new Set(reason)].join(',') })
    for (const r of reason) bad[r] = (bad[r] || 0) + 1
  }
}

console.log('Total rows:', total)
console.log('Bad rows:', badRows.length)
console.log('Reason counts:', bad)
console.log('Published bad:', badRows.filter(() => true).length)
