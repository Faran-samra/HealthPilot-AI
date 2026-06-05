/**
 * Roman Urdu / mixed-language → standardized English clinical text for embedding search.
 * NHS chunks are English; embed queries must be English-first for accurate vector match.
 */

import { matchMedicalSymptomRules } from './medical-synonyms.ts'
import type { SymptomQueryContext } from './symptom-query.ts'

export interface NormalizedEmbeddingQuery {
  /** Passed to embedQuery — English clinical concepts only */
  text: string
  originalUserText: string
  clinicalConcepts: string[]
  conditionSlugs: string[]
  matchedSummaries: string[]
}

/** Word/phrase replacements before rule matching (Roman Urdu + Urdu script). */
const PHRASE_TOKEN_MAP: Array<[RegExp, string]> = [
  [/peeli?\s+aankh(?:en|an)?/gi, 'yellow eyes jaundice'],
  [/zard\s+(?:aankh|ankh|ankein|jild)/gi, 'yellow eyes or skin jaundice'],
  [/\bbukhar\b|\bbukhaar\b|\bbukhhar\b/gi, 'fever'],
  [/pet\s+dard/gi, 'abdominal pain stomach pain'],
  [/sar\s+dard/gi, 'headache'],
  [/\bkhansi\b|\bkhasi\b/gi, 'cough'],
  [/\bpiyas\b|\bpyaas\b/gi, 'thirst dehydration'],
  [/pani\s+ki\s+kami/gi, 'dehydration fluid loss'],
  [/loose\s+motion/gi, 'diarrhoea'],
  [/\bdast\b/gi, 'diarrhoea'],
  [/doray|dora\b/gi, 'seizure convulsion'],
  [/behosh|behoshi/gi, 'unconsciousness'],
  [/chakkar/gi, 'dizziness vertigo'],
  [/zukam|nazla/gi, 'common cold flu'],
  [/kamzori/gi, 'weakness fatigue'],
  [/ulti/gi, 'vomiting'],
  [/khujli/gi, 'itching rash'],
  [/بخار/g, 'fever'],
  [/یرقان/g, 'jaundice'],
  [/زرد/g, 'yellow jaundice'],
  [/آنکھ/g, 'eyes'],
  [/جلد/g, 'skin'],
  [/پیٹ/g, 'stomach abdomen'],
  [/پیاس/g, 'thirst dehydration'],
  [/کھانسی/g, 'cough'],
  [/قے/g, 'vomiting'],
]

export function applyRomanUrduPhraseMap(text: string): string {
  let out = text
  for (const [pattern, replacement] of PHRASE_TOKEN_MAP) {
    out = out.replace(pattern, replacement)
  }
  return out
}

/** Clinical focus blocks (disambiguation) — English only. */
export function buildClinicalFocusBlocks(ctx: SymptomQueryContext): string[] {
  const blocks: string[] = []

  if (ctx.meansJaundiceNotYellowFever || (ctx.hasJaundiceSigns && !ctx.hasFever)) {
    blocks.push(
      'Clinical focus: jaundice, icterus, yellow discoloration of skin or eyes, liver disease, bilirubin, hepatitis, gallstones, obstructive jaundice'
    )
  } else if (ctx.hasJaundiceSigns) {
    blocks.push('Clinical focus: jaundice, liver disease, hepatitis, bilirubin')
  } else if (ctx.claimsYellowFeverDisease && ctx.deniedYellowFeverTravel) {
    blocks.push(
      'Yellow fever virus unlikely without travel to Africa or South America; evaluate fever, hepatitis, jaundice, liver function in Pakistan'
    )
  }

  const base = ctx.userLines.join(' ')
  if (ctx.hasFever && /stomach|abdomen|vomit|nausea|liver/i.test(base)) {
    blocks.push(
      'Clinical focus: fever with abdominal pain or vomiting, hepatitis, typhoid, gastroenteritis'
    )
  }

  if (
    ctx.medicalSynonyms.conditionSlugs.includes('dehydration') ||
    /dehydrat|ORS|rehydration|thirst/i.test(base)
  ) {
    blocks.push(
      'Clinical focus: dehydration, thirst, dry mouth, reduced urination, oral rehydration ORS, gastroenteritis, vomiting, diarrhoea'
    )
  }

  if (
    /yellow fever/i.test(base) &&
    !ctx.meansJaundiceNotYellowFever &&
    ctx.hasFever &&
    !ctx.deniedYellowFeverTravel
  ) {
    blocks.push('Clinical focus: yellow fever arbovirus, mosquito bite, travel vaccination')
  }

  if (/epilepsy|seizure|convulsion|\bfits\b|doray/i.test(base)) {
    blocks.push('Clinical focus: epilepsy, seizures, convulsions, neurology')
  }

  if (
    ctx.hasFever &&
    !ctx.deniedFever &&
    /\d+\s*(week|weeks|haft|day|days|din|mahin)|do\s+haft|lagataar|prolonged/i.test(base)
  ) {
    blocks.push(
      'Clinical focus: prolonged fever, typhoid, malaria, dengue, tuberculosis, urinary tract infection, chills, night sweats, body aches, appetite loss — Pakistan endemic infections'
    )
  }

  return blocks
}

function extractDurationContext(text: string): string | null {
  const m = text.match(
    /\d+\s*(?:day|days|week|weeks|month|months|hour|hours)|since\s+\d|for\s+\d+\s*(?:day|week)|\d+\s*dino/i
  )
  return m ? `Duration or timing: ${m[0]}` : null
}

function englishLinesFromUserText(userText: string): string[] {
  const mapped = applyRomanUrduPhraseMap(userText)
  const rules = matchMedicalSymptomRules(`${userText}\n${mapped}`)
  const summaries = rules.map((r) => r.englishSummary)
  return [...new Set(summaries)]
}

/**
 * Build English-first text for vector embedding. Does not include raw Roman Urdu
 * when synonym rules matched; uses token-mapped English fallback otherwise.
 */
export function normalizeSymptomQueryForEmbedding(ctx: SymptomQueryContext): NormalizedEmbeddingQuery {
  const originalUserText = ctx.userLines.join('\n').trim()
  const conversationText = ctx.userLines.join('\n')
  const tokenMapped = applyRomanUrduPhraseMap(conversationText)

  const matchedSummaries = englishLinesFromUserText(conversationText)
  const syn = ctx.medicalSynonyms
  const clinicalConcepts = [...new Set([...syn.searchTerms, ...syn.conditionSlugs])]

  const lines: string[] = [
    'Medical symptom search (Pakistan patient, English clinical terms for NHS knowledge base):',
  ]

  if (matchedSummaries.length) {
    lines.push('', 'Reported symptoms and signs:')
    for (const s of matchedSummaries) {
      lines.push(`- ${s}`)
    }
  } else {
    const fallback = tokenMapped
      .replace(/[^\x20-\x7E\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (fallback.length > 12) {
      lines.push('', `Symptom description (translated tokens): ${fallback.slice(0, 400)}`)
    }
  }

  if (clinicalConcepts.length) {
    lines.push('', `Standardized terms: ${clinicalConcepts.slice(0, 28).join(', ')}`)
  }

  if (syn.conditionSlugs.length) {
    lines.push('', `Related NHS conditions: ${syn.conditionSlugs.join(', ')}`)
  }

  const duration = extractDurationContext(conversationText)
  if (duration) lines.push('', duration)

  if (ctx.deniedFever) lines.push('', 'Patient denies fever.')
  if (ctx.hasFever && !ctx.deniedFever) lines.push('', 'Patient reports fever.')

  for (const block of buildClinicalFocusBlocks(ctx)) {
    lines.push('', block)
  }

  return {
    text: lines.join('\n').slice(0, 2000),
    originalUserText,
    clinicalConcepts,
    conditionSlugs: syn.conditionSlugs,
    matchedSummaries,
  }
}
