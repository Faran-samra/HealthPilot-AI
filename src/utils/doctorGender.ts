/** Resolve doctor gender for filters and badges (DB value + name heuristics for Pakistan). */

export type DoctorGender = 'male' | 'female'

const TITLE_PREFIX =
  /^(dr\.?|prof\.?|asst\.?|assoc\.?|assistant|associate|professor|mr\.?|mrs\.?|ms\.?|miss\.?)\s+/i

/** Common female given names in Pakistan (Latin script). */
const FEMALE_GIVEN_NAMES = new Set([
  'aamina', 'amna', 'ambreen', 'aneeqa', 'aneela', 'aneesa', 'asifa', 'asma', 'ayesha', 'aisha',
  'bushra', 'farah', 'fariha', 'fatima', 'fozia', 'ghazala', 'hina', 'humaira', 'iqra', 'irum',
  'kanwal', 'kinza', 'kiran', 'laiba', 'lubna', 'maham', 'mahnoor', 'maria', 'maryam', 'mishal',
  'nadia', 'naima', 'nazia', 'nida', 'nighat', 'nuzhat', 'rabia', 'riffat', 'rubina', 'sadia',
  'saima', 'saira', 'samina', 'sana', 'sania', 'sara', 'sarah', 'saiqa', 'samina', 'samira',
  'shazia', 'sidra', 'sumaira', 'tehmina', 'tehsina', 'uzma', 'zainab', 'zara', 'zeba',
  'qundeel', 'rebecca', 'benish', 'beenish', 'sumbul', 'haleema', 'rukhsana', 'shagufta',
])

const FEMALE_NAME_PATTERN =
  /\b(mrs\.?|ms\.?|miss\b|female\s+doctor)\b/i

const MALE_NAME_PATTERN = /\bmr\.?\s+(?!mrs)/i

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/[^a-z]/g, '')
}

/** First given name after stripping honorifics / repeated "Dr." */
export function extractGivenName(fullName: string): string | null {
  let rest = fullName.trim()
  for (let i = 0; i < 6; i++) {
    const m = rest.match(TITLE_PREFIX)
    if (!m) break
    rest = rest.slice(m[0].length).trim()
  }
  const token = rest.split(/\s+/)[0]
  if (!token) return null
  const normalized = normalizeToken(token)
  return normalized || null
}

export function inferGenderFromName(fullName: string): DoctorGender | null {
  if (!fullName?.trim()) return null
  if (FEMALE_NAME_PATTERN.test(fullName)) return 'female'
  if (MALE_NAME_PATTERN.test(fullName)) return 'male'

  const given = extractGivenName(fullName)
  if (given && FEMALE_GIVEN_NAMES.has(given)) return 'female'

  return null
}

export function extractGenderFromProfileHtml(html: string): DoctorGender | null {
  if (/\bfemale\s+doctor\b/i.test(html)) return 'female'
  if (/"gender"\s*:\s*"female"/i.test(html)) return 'female'
  if (/"gender"\s*:\s*"male"/i.test(html)) return 'male'
  if (/\bmale\s+doctor\b/i.test(html)) return 'male'
  return null
}

export function resolveDoctorGender(
  stored: DoctorGender | null | undefined,
  fullName: string
): DoctorGender | null {
  if (stored === 'male' || stored === 'female') return stored
  return inferGenderFromName(fullName)
}

export function matchesGenderFilter(
  doctor: { gender?: DoctorGender | null; full_name: string },
  filter: DoctorGender
): boolean {
  const resolved = resolveDoctorGender(doctor.gender, doctor.full_name)
  if (filter === 'female') return resolved === 'female'
  // Male filter: explicit males + unknown (excludes inferred/stored female)
  return resolved !== 'female'
}
