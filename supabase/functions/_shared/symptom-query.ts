/**
 * Parse conversation for disambiguation (e.g. "yellow fever" vs jaundice) and RAG query expansion.
 */

import { mergeSynonymExpansionWithInferred } from './condition-slug-inference.ts'
import { expandMedicalSynonyms, type MedicalSynonymExpansion } from './medical-synonyms.ts'
import { normalizeSymptomQueryForEmbedding } from './rag-query-normalize.ts'

const STOP_WORDS = new Set([
  'have', 'from', 'the', 'last', 'three', 'days', 'with', 'that', 'this', 'your',
  'when', 'what', 'does', 'mean', 'said', 'also', 'very', 'much', 'been', 'were',
  'are', 'was', 'not', 'yes', 'for', 'and', 'you', 'how', 'many', 'disease',
])

export interface SymptomQueryContext {
  userText: string
  userLines: string[]
  /** User reports fever (not "no fever"); "yellow fever" phrase excluded. */
  hasFever: boolean
  /** Yellow skin/eyes / jaundice in user messages only. */
  hasJaundiceSigns: boolean
  /** Colloquial "yellow fever" → jaundice, not arboviral disease. */
  meansJaundiceNotYellowFever: boolean
  deniedFever: boolean
  /** User said they mean the viral disease (not just the phrase). */
  claimsYellowFeverDisease: boolean
  /** Answered no to travel to Africa/South America. */
  deniedYellowFeverTravel: boolean
  /** From medical-synonyms.ts — NHS condition_slug boosts for RAG */
  medicalSynonyms: MedicalSynonymExpansion
}

/** Remove "yellow fever" so word "fever" does not count as a symptom. */
export function textForInfectionSignals(text: string): string {
  return text.replace(/yellow\s+fever(\s+disease)?/gi, ' ')
}

export function parseSymptomQueryContext(
  userLines: string[],
  assistantLines: string[] = []
): SymptomQueryContext {
  const userText = userLines.join(' ').trim()
  const userCombined = userLines.join(' ').toLowerCase()
  const combined = `${userLines.join(' ')} ${assistantLines.join(' ')}`.toLowerCase()
  const signalText = textForInfectionSignals(combined)

  const lastUser = userLines[userLines.length - 1]?.trim().toLowerCase() ?? ''
  const lastAssistant = assistantLines[assistantLines.length - 1] ?? ''
  const assistantAskedTravel = /travel|africa|south america/i.test(lastAssistant)
  const assistantAskedBodyFever =
    /experienc.*fever|fever along|have.*fever|بخار/i.test(lastAssistant) &&
    !assistantAskedTravel

  const deniedFever =
    /\bno fever\b|\bnot fever\b|\bfever no\b|\bwithout fever\b|بخار نہیں|بخار نهیں|no high fever/i.test(
      combined
    ) ||
    (assistantAskedBodyFever && /^no\.?$/i.test(lastUser))

  const hasFever =
    !deniedFever &&
    (/\bfever\b|بخار|high temperature|bukhar|تیز بخار/i.test(signalText) ||
      /\btemperature\b/i.test(signalText))

  const hasJaundiceSigns =
    /jaundice|icterus|یرقان|yellowing|yellow (skin|eyes)|yellow (colour|color)|زرد|پیلا/i.test(
      userCombined
    ) ||
    (/yellow/i.test(userCombined) && /(skin|eyes|جلد|آنکھ)/i.test(userCombined))

  const saidYellowFeverPhrase = /yellow fever/i.test(combined)

  const claimsYellowFeverDisease =
    /yellow fever\s+disease|yellow fever\s+virus|the disease yellow fever|mean the disease/i.test(
      userCombined
    ) || /yellow fever disease/i.test(userCombined)

  const deniedYellowFeverTravel =
    /\bno travel\b|haven'?t traveled|did not travel|not traveled/i.test(userCombined) ||
    (assistantAskedTravel && /^no\.?$/i.test(lastUser))

  const meansJaundiceNotYellowFever =
    saidYellowFeverPhrase &&
    !claimsYellowFeverDisease &&
    (hasJaundiceSigns || deniedFever) &&
    !hasFever

  const medicalSynonyms = mergeSynonymExpansionWithInferred(
    userLines.join('\n'),
    expandMedicalSynonyms(userLines.join('\n'))
  )

  return {
    userText: userLines.length ? userLines.join('\n') : userText,
    userLines,
    hasFever,
    hasJaundiceSigns,
    meansJaundiceNotYellowFever,
    deniedFever,
    claimsYellowFeverDisease,
    deniedYellowFeverTravel,
    medicalSynonyms,
  }
}

/** One more follow-up before analysis when user claims YF disease but gave no real symptoms. */
const SEIZURE_IN_TEXT =
  /epilepsy|seizure|convulsion|\bfits\b|doray|dora\b|dore\b|behosh|chakkar|chakar/i

const WANTS_GUIDANCE_NOW =
  /doctor|docor|neurologist|suggest\s+kr|recommend|qareeb|near\s*(me|by)|area\s*k|acha\s+sa|sahi\s+sa|samajh\s+nahi|samaj\s+nahi|confus|kya\s+masla|bus\s+.*doctor|poch\s+rhe|doctor\s+zaroor|kuch\s+samaj|poch\s+rhe\s+ho|app\s+muje/i

const AFFIRMATIVE_ONLY =
  /^(han|haan|ha|ji|jee|yes|yep|yeah|bilkul|theek|ok|okay|y)$/i

/**
 * "han" / "yes" alone is not meaningful for analysis — attach the last assistant question.
 */
export function enrichAffirmativeReplies(
  userLines: string[],
  assistantLines: string[] = []
): string[] {
  if (!userLines.length) return userLines
  const last = userLines[userLines.length - 1]?.trim() ?? ''
  if (!AFFIRMATIVE_ONLY.test(last)) return userLines

  const lastQ = assistantLines[assistantLines.length - 1]?.trim()
  if (!lastQ || lastQ.length < 8) return userLines

  const copy = [...userLines]
  copy[copy.length - 1] =
    `User answered yes (${last}) to: ${lastQ.replace(/\s+/g, ' ').slice(0, 280)}`
  return copy
}

/** User asks for explanation or doctor recommendation — ready to finalize. */
export function userRequestsImmediateGuidance(userLines: string[]): boolean {
  if (!userLines.length) return false
  const last = userLines[userLines.length - 1] ?? ''
  const all = userLines.join(' ')
  return WANTS_GUIDANCE_NOW.test(last) || WANTS_GUIDANCE_NOW.test(all)
}

/** First message: seizures + nearby doctor request — skip irrelevant follow-ups. */
export function userWantsNearbyDoctorForSeizures(userLines: string[]): boolean {
  const all = userLines.join(' ').toLowerCase()
  if (!SEIZURE_IN_TEXT.test(all)) return false
  return (
    /docor|doctor|neurologist/i.test(all) &&
    /qareeb|nearby|area|paas|suggest|recommend|zaroor/i.test(all)
  )
}

export function needsYellowFeverSymptomFollowUp(ctx: SymptomQueryContext): boolean {
  if (!ctx.claimsYellowFeverDisease || !ctx.deniedYellowFeverTravel) return false

  const userOnly = ctx.userLines.join(' ').toLowerCase()
  const signalUser = textForInfectionSignals(userOnly)

  const hasDuration = /\d+\s*(day|days|week|month)|since|ago|کل|دن سے|for \d/i.test(userOnly)
  const hasOtherSymptoms =
    /abdominal|belly|stomach|vomit|nausea|pain|پیٹ|dark urine|pale stool|itch|weakness|thirst/i.test(
      userOnly
    )
  const userReportsFever =
    !ctx.deniedFever && /\bfever\b|بخار|temperature|bukhar/i.test(signalUser)

  return !(
    ctx.hasJaundiceSigns ||
    userReportsFever ||
    ctx.deniedFever ||
    hasDuration ||
    hasOtherSymptoms
  )
}

function significantTerms(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, ' ')
  const raw = normalized
    .split(/[\s-]+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
  const extra: string[] = []
  if (/jaundice|icterus|یرقان|yellow.*eye|yellow.*skin|peeli|zard/i.test(text)) {
    extra.push('jaundice', 'liver', 'hepatitis', 'bilirubin', 'gallbladder', 'یرقان', 'جگر')
  }
  if (/stomach|abdomen|پیٹ|abdominal/i.test(text)) {
    extra.push('abdominal', 'stomach', 'liver', 'gastro', 'vomit', 'nausea')
  }
  if (/\bfever\b|بخار|bukhar|typhoid|dengue|malaria/i.test(textForInfectionSignals(text))) {
    extra.push('fever', 'infection', 'typhoid', 'malaria', 'dengue', 'viral illness')
  }
  if (/dehydrat|piyas|pyaas|پیاس|ORS|rehydration|oral rehydration|fluid loss|thirst/i.test(text)) {
    extra.push('dehydration', 'thirst', 'ORS', 'oral rehydration', 'fluids', 'diarrhoea', 'vomiting')
  }
  return [...new Set([...raw, ...extra])]
}

/** English-normalized query for RAG ranking overlap (same concepts as embedding). */
export function expandSymptomQueryForRag(ctx: SymptomQueryContext): string {
  return normalizeSymptomQueryForEmbedding(ctx).text
}

export function significantTermsForRag(ctx: SymptomQueryContext): string[] {
  const norm = normalizeSymptomQueryForEmbedding(ctx)
  const fromConcepts = norm.clinicalConcepts.filter((t) => t.length > 2)
  const fromExpand = significantTerms(norm.text)
  return [...new Set([...fromConcepts, ...fromExpand])]
}
