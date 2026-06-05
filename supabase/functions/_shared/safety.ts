import type { SymptomAnalysis } from './schemas.ts'
import { SPECIALTY_SLUGS, type SeverityLevel } from './models.ts'
import {
  buildAcromegalyEnglishExplanation,
  buildAcromegalyRomanUrduSummary,
  buildAnaphylaxisEnglishExplanation,
  buildAnaphylaxisRomanUrduSummary,
  buildFeverEnglishExplanation,
  buildFeverRomanUrduSummary,
  buildPalpitationsEnglishExplanation,
  buildPalpitationsRomanUrduSummary,
  buildSeizureEnglishExplanation,
  buildSeizureRomanUrduSummary,
  isGarbledAnalysisLine,
  isGarbledUrduSummary,
  isWeakFeverAnalysisText,
  looksLikeHindiRomanUrdu,
  polishPakistaniRomanUrdu,
} from './roman-urdu-quality.ts'
import { isEnglishUserText, isRomanUrduText } from './roman-urdu.ts'
import { isAnaphylaxisContext } from './emergency-detect.ts'
import {
  hasCardiacRedFlags,
  hasFeverSignals,
  isAllergicRhinitisPattern,
  isPalpitationsPattern,
  isStressPalpitationsPattern,
  palpitationsRecommendedSlug,
} from './symptom-intent.ts'
import { textForInfectionSignals } from './symptom-query.ts'

const DIAGNOSIS_PHRASES = [
  /you have\s+\w+/i,
  /you are diagnosed with/i,
  /definitely\s+have/i,
  /confirmed\s+case of/i,
]

const EMERGENCY_NUMBERS = 'Rescue 1122 or Edhi 115'

const INFECTION_ONLY_CONDITIONS = [
  /^dengue/i,
  /^typhoid/i,
  /^malaria/i,
  /ڈینگی/,
  /ٹائیفائیڈ/,
  /ملیریا/,
]

const INFECTION_SIGNALS =
  /fever|bukhar|بخار|temperature|dengue|typhoid|malaria|rash|کھانسی|cough|vomit|bleeding|خون|jor\b/i

const FATIGUE_LIFESTYLE =
  /fatigue|tired|weakness|kamzori|kamzor|thak|thakan|handpractice|masturbat|کمزوری|تھکن|sleep|neend|نیند|stress/i

const SEIZURE_CONTEXT =
  /epilepsy|seizure|convulsion|\bfits\b|doray|dora\b|janay|behosh|behoshi|ankh.*band|eyes?\s+clos|loss of control/i

const ACROMEGALY_CONTEXT =
  /acromegaly|gigantism|pituitary|haath.*barh|hath.*barh|face.*barh|chehra.*barh|hands?.*(larger|big|barh)|growth hormone|IGF/i

const LIFESTYLE_FILLER_CONDITIONS =
  /sleep deprivation|nutritional deficiency|anemia \(needs blood tests\)/i

const SPECIFIC_CONDITION_CONTEXT =
  /acromegaly|gigantism|pituitary|haath.*barh|hath.*barh|face.*barh|enlarged (hands|face)|growth hormone|epilepsy|seizure|doray|jaundice|یرقان|diabetes|thyroid/i

const MEDICATION_MENTION =
  /dawai|medicine|medication|tablet|pills?|anti.?epilep|valpro|carbamaz|levetir|lamotr|phenytoin|taking\s+(med|dawai)|dawai\s+le|medicine\s+le/i

const MEDICATION_DENIED =
  /no medicine|not taking|never took|koi dawai nahi|medicine nahi|dawai nahi|dawai\s+(b\s+)?ni|ni\s+.*dawai|dawai.*ni\s+(le|leta|karta|istemal)|istemal\s+nahi|bina dawai|without medication/i

function userReportsTakingMedication(text: string): boolean {
  if (MEDICATION_DENIED.test(text)) return false
  if (!MEDICATION_MENTION.test(text)) return false
  return /\b(le\s+rha|leta|leti|use\s+karta|khata|kha\s+raha|taking|istemal\s+kar)\b/i.test(text)
}

const BREAKTHROUGH_CONDITION = /breakthrough|medication non|dose adjust|prescription.*adjust|dawai.*kaam nahi|medicine.*not work|mojooda dawai|current medication/i

export function applySafetyRules(
  analysis: SymptomAnalysis,
  userMessagesText = ''
): SymptomAnalysis {
  const out = { ...analysis }

  if (!SPECIALTY_SLUGS.includes(out.recommended_specialty_slug)) {
    out.recommended_specialty_slug = 'general'
    out.recommended_specialty = 'General Physician'
  }

  const combined = `${out.explanation} ${out.brief_summary}`.toLowerCase()
  for (const pattern of DIAGNOSIS_PHRASES) {
    if (pattern.test(combined)) {
      out.disclaimer =
        `${out.disclaimer} This tool does not provide a medical diagnosis. Please see a qualified doctor.`
      break
    }
  }

  if (out.severity_level === 'emergency') {
    if (!out.red_flags?.length) {
      out.red_flags = [`Seek emergency care immediately. Call ${EMERGENCY_NUMBERS}.`]
    } else {
      const hasNumber = out.red_flags.some((f) => /1122|115|edhi|rescue/i.test(f))
      if (!hasNumber) {
        out.red_flags = [...out.red_flags, `Call ${EMERGENCY_NUMBERS} if symptoms are severe.`]
      }
    }
  }

  const chestEmergency =
    /chest pain|سینے کا درد/i.test(userMessagesText) &&
    /severe|crushing|radiat|بھاری|شدید/i.test(userMessagesText)
  if (chestEmergency && severityRank(out.severity_level) < severityRank('severe')) {
    out.severity_level = 'severe'
  }

  const infectionSignalText = textForInfectionSignals(userMessagesText)

  if (
    !INFECTION_SIGNALS.test(infectionSignalText) &&
    !SEIZURE_CONTEXT.test(userMessagesText) &&
    !SPECIFIC_CONDITION_CONTEXT.test(userMessagesText)
  ) {
    out.possible_conditions = (out.possible_conditions ?? []).filter(
      (c) => !INFECTION_ONLY_CONDITIONS.some((p) => p.test(c.trim()))
    )
    if (out.possible_conditions.length < 2) {
      out.possible_conditions = [
        ...out.possible_conditions,
        'Sleep deprivation or stress',
        'Nutritional deficiency or anemia (needs blood tests)',
      ].slice(0, 4)
    }

    const scrubInfection = (text: string) =>
      text
        .replace(/\b(dengue fever|dengue|typhoid|malaria)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim()

    out.explanation = scrubInfection(out.explanation)
    out.brief_summary = scrubInfection(out.brief_summary)
    if (out.primary_condition) {
      out.primary_condition = scrubInfection(out.primary_condition)
    }
  }

  if (
    FATIGUE_LIFESTYLE.test(userMessagesText) &&
    !INFECTION_SIGNALS.test(userMessagesText) &&
    out.severity_level === 'mild'
  ) {
    out.severity_level = 'moderate'
  }

  if (!out.disclaimer.includes('not a medical diagnosis') && !out.disclaimer.includes('not a diagnosis')) {
    out.disclaimer = `${out.disclaimer} This is health guidance only, not a medical diagnosis.`
  }

  applyJaundiceVsYellowFeverFix(out, userMessagesText)
  applyYellowFeverPakistanRules(out, userMessagesText)
  applySeizureWithoutMedicationRules(out, userMessagesText)
  applyAcromegalyRules(out, userMessagesText)
  applyProlongedFeverRules(out, userMessagesText)
  applyAllergicRhinitisRules(out, userMessagesText)
  applyPalpitationsRules(out, userMessagesText)

  return out
}

const FEVER_CASE_CONTEXT =
  /\b(bukhar|bukhaar|bukhhar|fever|بخار|temperature|thand lag)/i

const Jaundice_CONDITION = /jaundice|icterus|یرقان|hepatitis|yellow (skin|eyes)|peeli|zard/i

/** Pakistan-relevant fever workup; fix garbled Urdu and wrong jaundice differentials. */
function applyProlongedFeverRules(out: SymptomAnalysis, userText: string): void {
  const signal = textForInfectionSignals(userText)
  if (!FEVER_CASE_CONTEXT.test(signal)) return

  const hasJaundiceSigns =
    /jaundice|icterus|یرقان|yellow (skin|eyes)|peeli aankh|zard.*(aankh|jild)/i.test(userText)
  const deniedSunRain =
    /nahi.*dhoop|na to dhoop|no.*sun|diet.*nahi|zyada change nahi/i.test(userText)

  const scrub = (text: string): string => {
    let s = text
    if (deniedSunRain) {
      s = s
        .replace(/dhoop ya barish[^.]*\.?/gi, '')
        .replace(/sun or rain[^.]*\.?/gi, '')
        .replace(/diet mein[^.]*badlaav[^.]*\.?/gi, '')
    }
    return s
      .replace(/samananoj|samanajo|samaanaj/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  out.possible_conditions = (out.possible_conditions ?? []).filter((c) => {
    const trimmed = c.trim()
    if (!hasJaundiceSigns && Jaundice_CONDITION.test(trimmed)) return false
    return !isGarbledAnalysisLine(trimmed, userText)
  })

  const pakFeverConditions = [
    'Typhoid (needs blood tests)',
    'Malaria (needs blood smear or rapid test)',
    'Dengue fever (seasonal in Pakistan)',
    'Viral fever or flu-like illness',
  ]
  for (const item of pakFeverConditions) {
    if ((out.possible_conditions?.length ?? 0) >= 4) break
    if (!out.possible_conditions?.some((c) => c.toLowerCase().includes(item.slice(0, 8).toLowerCase()))) {
      out.possible_conditions = [...(out.possible_conditions ?? []), item]
    }
  }
  out.possible_conditions = out.possible_conditions?.slice(0, 4) ?? []

  const prolonged = /2\s*haft|two\s*week|\d+\s*week|14\s*day|lagataar/i.test(userText)
  const eveningFever = /shaam|evening|din ko bukhar/i.test(userText)
  const bodyAches = /body ache|jism.*dard/i.test(userText)

  if (
    isWeakFeverAnalysisText(out.primary_condition ?? '') ||
    /diagnosis/i.test(out.primary_condition ?? '')
  ) {
    out.primary_condition = prolonged
      ? 'Prolonged fever with weakness'
      : 'Fever with weakness and body aches'
  } else if (!out.primary_condition?.trim()) {
    out.primary_condition = prolonged ? 'Prolonged fever with weakness' : 'Fever with weakness'
  }

  if (prolonged && severityRank(out.severity_level) < severityRank('moderate')) {
    out.severity_level = 'moderate'
  }

  const goodBrief = prolonged
    ? 'About two weeks of fever with weakness and body aches — needs a GP visit and blood tests (CBC, typhoid; malaria/dengue if appropriate).'
    : eveningFever
      ? 'Fever mainly in the day or evening with weakness and body aches — should be checked by a doctor.'
      : 'Fever with weakness — needs medical assessment and likely blood tests.'

  out.brief_summary = scrub(out.brief_summary ?? '')
  if (
    !out.brief_summary ||
    isGarbledAnalysisLine(out.brief_summary, userText) ||
    isWeakFeverAnalysisText(out.brief_summary) ||
    out.brief_summary.length < 55 ||
    !/gp|physician|test|week|blood|doctor|typhoid|malaria/i.test(out.brief_summary)
  ) {
    out.brief_summary = goodBrief
  }

  out.explanation = scrub(out.explanation ?? '')
  if (
    !out.explanation ||
    isGarbledUrduSummary(out.explanation, userText) ||
    isWeakFeverAnalysisText(out.explanation) ||
    /samananoj|dhoop ya barish/i.test(out.explanation)
  ) {
    out.explanation = buildFeverEnglishExplanation(userText)
  }

  out.recommended_specialty_slug = 'general'
  out.recommended_specialty = 'General Physician'

  const badTips = (out.first_aid_tips ?? []).some(
    (t) => isGarbledAnalysisLine(t, userText) || /shayad|sudharay/i.test(t)
  )
  if (badTips || (out.first_aid_tips?.length ?? 0) < 2) {
    out.first_aid_tips = [
      'Plenty of fluids (pani, ORS if vomiting or loose motions)',
      'Rest at home until a doctor has assessed you',
      'Paracetamol only as directed — avoid random antibiotics',
      'Note fever times, highest temperature, and any rash',
      'Book a GP visit within 1–2 days for prolonged fever',
    ]
  } else {
    out.first_aid_tips = out.first_aid_tips.map((t) => scrub(t)).filter((t) => t.length > 8)
  }

  const badFlags = (out.red_flags ?? []).some((f) => isGarbledAnalysisLine(f, userText))
  if (badFlags || (out.red_flags?.length ?? 0) < 2) {
    out.red_flags = [
      'Fever above 39°C lasting more than 3 days without improvement',
      'Severe dehydration, confusion, or difficulty breathing',
      'Persistent vomiting or bloody stool',
      'Call Rescue 1122 or Edhi 115 in an emergency',
    ]
  }

  const feverSummary = buildFeverRomanUrduSummary(userText)
  const userWritesRoman =
    isRomanUrduText(userText) || /\b(mujhe|mera|nahi|ni|ji|hai)\b/i.test(userText)

  if (feverSummary && userWritesRoman) {
    out.urdu_summary = feverSummary
  } else if (feverSummary) {
    const current = out.urdu_summary ?? ''
    if (
      !current ||
      isGarbledUrduSummary(current, userText) ||
      looksLikeHindiRomanUrdu(current)
    ) {
      out.urdu_summary = feverSummary
    } else {
      out.urdu_summary = polishPakistaniRomanUrdu(scrub(current))
    }
  } else if (out.urdu_summary) {
    out.urdu_summary = polishPakistaniRomanUrdu(scrub(out.urdu_summary))
  }

  if (out.condition_confidence === 'low') {
    out.condition_confidence = 'medium'
  }
}

/** Fast heartbeat / palpitations — cardiology or GP, not neurology. */
function applyPalpitationsRules(out: SymptomAnalysis, userText: string): void {
  if (!isPalpitationsPattern(userText)) return

  const slug = palpitationsRecommendedSlug(userText)
  const label =
    slug === 'cardiology'
      ? 'Cardiologist or General Physician'
      : slug === 'psychiatry'
        ? 'Psychiatrist'
        : 'General Physician'

  out.recommended_specialty_slug = slug
  out.recommended_specialty = label

  if (/neurolog|psychiatr/i.test(out.recommended_specialty) && slug === 'cardiology') {
    out.recommended_specialty = label
  }

  if (
    !out.primary_condition?.trim() ||
    /neurolog|psychiatr|seizure|epilepsy/i.test(out.primary_condition)
  ) {
    out.primary_condition = isStressPalpitationsPattern(userText)
      ? 'Stress- or caffeine-related palpitations (fast heartbeat)'
      : 'Palpitations (fast heartbeat) — needs cardiac assessment'
  }

  if (!out.brief_summary?.trim() || /neurolog|psychiatr/i.test(out.brief_summary)) {
    out.brief_summary =
      'Brief episodes of fast heartbeat with stress, tea/caffeine, or poor sleep — often benign but should be checked with a doctor and possibly an ECG.'
  }

  out.possible_conditions = (out.possible_conditions ?? []).filter(
    (c) => !/neurolog|epilepsy|seizure|psychiatr/i.test(c) || /anxiety/i.test(c)
  )

  const cardiacConditions = [
    'Anxiety- or stress-related palpitations',
    'Caffeine or tea-triggered tachycardia',
    'Benign palpitations (needs ECG to rule out arrhythmia)',
  ]
  if (isStressPalpitationsPattern(userText)) {
    cardiacConditions.push('Poor sleep contributing to anxiety symptoms')
  }
  for (const item of cardiacConditions) {
    if ((out.possible_conditions?.length ?? 0) >= 4) break
    if (!out.possible_conditions?.some((c) => c.toLowerCase().includes(item.slice(0, 12).toLowerCase()))) {
      out.possible_conditions = [...(out.possible_conditions ?? []), item]
    }
  }
  out.possible_conditions = out.possible_conditions?.slice(0, 4) ?? []

  if (/neurolog|psychiatr|seizure/i.test(out.explanation ?? '')) {
    out.explanation = buildPalpitationsEnglishExplanation()
  }

  if (hasCardiacRedFlags(userText)) {
    out.severity_level = 'moderate'
  } else if (isStressPalpitationsPattern(userText) && out.severity_level === 'severe') {
    out.severity_level = 'moderate'
  } else if (isStressPalpitationsPattern(userText) && out.severity_level === 'emergency') {
    out.severity_level = 'moderate'
  } else if (isStressPalpitationsPattern(userText) && out.severity_level === 'mild') {
    out.severity_level = 'mild'
  }

  const badTips = (out.first_aid_tips ?? []).some((t) => /neurolog|psychiatr only/i.test(t))
  if (badTips || (out.first_aid_tips?.length ?? 0) < 2) {
    out.first_aid_tips = [
      'Reduce tea/coffee especially on exam days; stay hydrated',
      'Practice slow breathing when episodes start; rest until heartbeat settles',
      'Improve sleep routine — fixed bedtime, less screen time before bed',
      'Book a GP or cardiologist visit for ECG and basic tests if episodes continue',
      'Seek emergency care if chest pain, fainting, or breathlessness occurs',
    ]
  }

  const palpSummary = buildPalpitationsRomanUrduSummary(userText)
  if (palpSummary) {
    const current = out.urdu_summary ?? ''
    if (
      !current ||
      isGarbledUrduSummary(current, userText) ||
      looksLikeHindiRomanUrdu(current) ||
      /neurolog/i.test(current)
    ) {
      out.urdu_summary = palpSummary
    }
  } else if (out.urdu_summary && /neurolog/i.test(out.urdu_summary)) {
    out.urdu_summary = ''
  }
}

/** Hay fever / allergic rhinitis — not a fever workup. */
function applyAllergicRhinitisRules(out: SymptomAnalysis, userText: string): void {
  if (!isAllergicRhinitisPattern(userText)) return

  out.possible_conditions = (out.possible_conditions ?? []).filter(
    (c) => !INFECTION_ONLY_CONDITIONS.some((re) => re.test(c)) && !/viral fever|flu-like/i.test(c)
  )

  const allergyConditions = [
    'Allergic rhinitis (hay fever)',
    'Dust or pollen allergy',
    'Seasonal nasal allergy',
  ]
  for (const item of allergyConditions) {
    if ((out.possible_conditions?.length ?? 0) >= 3) break
    if (!out.possible_conditions?.some((c) => c.toLowerCase().includes(item.slice(0, 10).toLowerCase()))) {
      out.possible_conditions = [...(out.possible_conditions ?? []), item]
    }
  }
  out.possible_conditions = out.possible_conditions?.slice(0, 4) ?? []

  if (
    !out.primary_condition?.trim() ||
    /fever|bukhar|typhoid|malaria|dengue|viral illness/i.test(out.primary_condition)
  ) {
    out.primary_condition = 'Allergic rhinitis (hay fever) with nasal and eye symptoms'
  }

  if (
    !out.brief_summary?.trim() ||
    /fever|bukhar|typhoid|malaria|dengue/i.test(out.brief_summary)
  ) {
    out.brief_summary =
      'Sneezing, watery eyes, and blocked nose worse outdoors or in dust — fits allergic rhinitis; usually mild but see a doctor if breathing is difficult.'
  }

  if (/typhoid|malaria|dengue|fever workup|bukhar/i.test(out.explanation ?? '')) {
    out.explanation =
      'Your symptoms suggest allergic rhinitis (hay fever), often triggered by dust, pollen, or wind. This is not a fever illness. Avoid triggers where possible, try saline nose rinses, and consider an over-the-counter antihistamine if you have used one safely before. See a GP or ENT specialist if symptoms persist or breathing becomes difficult.'
  }

  out.recommended_specialty_slug = 'ent'
  out.recommended_specialty = 'ENT Specialist or General Physician'

  if (out.severity_level !== 'emergency' && severityRank(out.severity_level) > severityRank('mild')) {
    out.severity_level = 'mild'
  }

  const hasGoodTips = (out.first_aid_tips ?? []).some((t) =>
    /antihistamine|dust|pollen|saline|mask/i.test(t)
  )
  if (!hasGoodTips) {
    out.first_aid_tips = [
      'Avoid dusty or windy outdoor areas when possible; wear a mask during high pollen or dust',
      'Saline nasal rinse or steam may ease a blocked nose',
      'Antihistamine (e.g. cetirizine or loratadine) may help if you have used it safely before — ask a pharmacist',
      'Keep windows closed on high-wind days; wash bedding if dust mites may be a trigger',
      'See a doctor if breathing difficulty, facial pain, or symptoms last beyond a few weeks',
    ]
  }
}

/** Correct GH excess / endocrine guidance; strip garbled Urdu and lifestyle filler. */
function applyAcromegalyRules(out: SymptomAnalysis, userText: string): void {
  if (!ACROMEGALY_CONTEXT.test(userText)) return

  const scrub = (text: string): string =>
    text
      .replace(/\bsharamadi\s+dawayo?\b/gi, '')
      .replace(/insulin jaisi hormone ki kami/gi, 'growth hormone zyada hona')
      .replace(/insulin deficiency/gi, 'excess growth hormone')
      .replace(/\s{2,}/g, ' ')
      .trim()

  out.primary_condition = out.primary_condition?.trim() || 'Possible acromegaly (excess growth hormone)'
  if (/insulin|kami|deficiency/i.test(out.primary_condition) && /acromegaly/i.test(userText)) {
    out.primary_condition = 'Possible acromegaly — needs endocrine evaluation'
  }

  out.brief_summary = scrub(out.brief_summary ?? '')
  if (!out.brief_summary || isGarbledAnalysisLine(out.brief_summary, userText)) {
    out.brief_summary =
      'Enlarging hands/face and recurring headaches over months — needs endocrinologist and hormone tests.'
  }

  out.explanation = buildAcromegalyEnglishExplanation()

  out.possible_conditions = (out.possible_conditions ?? []).filter(
    (c) => !LIFESTYLE_FILLER_CONDITIONS.test(c) && !isGarbledAnalysisLine(c, userText)
  )

  const endocrineConditions = [
    'Acromegaly (excess growth hormone — needs IGF-1 and specialist tests)',
    'Pituitary hormone disorder',
    'Chronic headaches linked to hormone imbalance',
  ]
  for (const item of endocrineConditions) {
    if ((out.possible_conditions?.length ?? 0) >= 4) break
    if (!out.possible_conditions?.some((c) => c.toLowerCase().includes(item.slice(0, 12).toLowerCase()))) {
      out.possible_conditions = [...(out.possible_conditions ?? []), item]
    }
  }
  out.possible_conditions = out.possible_conditions?.slice(0, 4) ?? []

  out.recommended_specialty_slug = 'endocrinology'
  out.recommended_specialty = 'Endocrinologist'

  if (severityRank(out.severity_level) > severityRank('moderate') && !/vision|sudden|emergency|behosh/i.test(userText)) {
    out.severity_level = 'moderate'
  } else if (severityRank(out.severity_level) < severityRank('moderate')) {
    out.severity_level = 'moderate'
  }

  const badTips = (out.first_aid_tips ?? []).some((t) =>
    /sharamadi|insulin kami|samasya/i.test(t)
  )
  if (badTips || (out.first_aid_tips?.length ?? 0) < 2) {
    out.first_aid_tips = [
      'Khud se hormone ya insulin ki dawai mat shuru karein — sirf endocrinologist ke mashware par',
      'Purani aur nayi tasveerein saath rakhein agar chehra/haath badla ho',
      'Sar dard ki frequency aur duration likh kar rakhein',
      'Balanced khana aur regular neend — lekin yeh tests ki jagah nahi le sakta',
      'Jaldi endocrinologist se appointment lein',
    ]
  } else {
    out.first_aid_tips = out.first_aid_tips.map((t) => scrub(t)).filter((t) => t.length > 8)
  }

  const badFlags = (out.red_flags ?? []).some((f) => /sharamadi|samasya/i.test(f))
  if (badFlags || (out.red_flags?.length ?? 0) < 2) {
    out.red_flags = [
      'Achanak bohot tez sar dard ya dekhne mein dikkat',
      'Severe chest pain or breathing difficulty',
      'Confusion, weakness on one side, or loss of consciousness',
      'Call Rescue 1122 or Edhi 115 in an emergency',
    ]
  }

  const summary = buildAcromegalyRomanUrduSummary(userText)
  if (summary) {
    out.urdu_summary = summary
  } else if (out.urdu_summary) {
    out.urdu_summary = polishPakistaniRomanUrdu(scrub(out.urdu_summary))
    const fallback = buildAcromegalyRomanUrduSummary(userText)
    if (fallback && (looksLikeHindiRomanUrdu(out.urdu_summary) || /sharamadi/i.test(out.urdu_summary))) {
      out.urdu_summary = fallback
    }
  }
}

/** Do not imply failed epilepsy treatment unless the user said they take medication. */
function applySeizureWithoutMedicationRules(
  out: SymptomAnalysis,
  userText: string
): void {
  if (!SEIZURE_CONTEXT.test(userText)) return

  if (userReportsTakingMedication(userText)) return

  const scrubText = (text: string): string => {
    let s = text
    s = s.replace(/\b(breakthrough)\s+seizures?\b/gi, 'repeated seizures')
    s = s.replace(/\bepilepsy\s*\(\s*breakthrough[^)]*\)/gi, 'Possible seizure disorder')
    s = s.replace(/\b(breakthrough)\s+seizures?\s*\([^)]*\)/gi, 'Repeated seizures')
    s = s.replace(
      /medication\s+(is\s+)?(not|isn't|no longer)\s+work\w*/gi,
      'needs medical assessment'
    )
    s = s.replace(/medicine\s+(not|isn't)\s+work\w*/gi, 'needs medical assessment')
    s = s.replace(/dawai\s+(kaam nahi|kam nahi|fail)/gi, 'needs assessment')
    s = s.replace(/mojooda\s+dawai[^.،]*[.،]?/gi, '')
    s = s.replace(/current\s+(medication|medicine|prescription)[^.]*[.]?/gi, '')
    s = s.replace(/dose\s+adjust\w*/gi, 'medical review')
    s = s.replace(/check\s+(your|apni)\s+(medication|medicine|dawai)[^.]*[.]?/gi, 'see a neurologist urgently')
    s = s.replace(/prescription\s+adjust[^.]*[.]?/gi, 'neurologist review')
    s = s.replace(/\s{2,}/g, ' ').trim()
    return s
  }

  if (
    !out.primary_condition ||
    out.primary_condition.trim().length < 8 ||
    /^doray?$/i.test(out.primary_condition.trim())
  ) {
    out.primary_condition = 'Possible seizures (doray) — neurologist assessment'
  }
  if (out.primary_condition && BREAKTHROUGH_CONDITION.test(out.primary_condition)) {
    out.primary_condition = 'Repeated seizures — urgent neurology review'
  }
  if (out.brief_summary) {
    out.brief_summary = scrubText(out.brief_summary)
    if (isGarbledAnalysisLine(out.brief_summary, userText)) {
      out.brief_summary =
        'User reports seizures (doray) and wants a nearby neurologist for assessment.'
    }
  }

  out.explanation = buildSeizureEnglishExplanation()
  if (out.urdu_summary) out.urdu_summary = scrubText(out.urdu_summary)

  out.possible_conditions = (out.possible_conditions ?? []).filter(
    (c) =>
      !BREAKTHROUGH_CONDITION.test(c) &&
      !isGarbledAnalysisLine(c, userText)
  )

  const clusterLikely =
    /\d+\s*(bar|times|episodes)|cluster|baar baar|6 bar|3 bar/i.test(userText) ||
    /\d+\s+seizure/i.test(userText)

  const replacements = clusterLikely
    ? [
        'Possible epilepsy or seizure disorder (needs neurologist evaluation)',
        'Cluster seizures — multiple episodes in a short time',
        'New or worsening seizure pattern',
      ]
    : [
        'Possible seizure disorder (needs neurologist evaluation)',
        'Epilepsy or seizures — needs proper assessment',
      ]

  for (const item of replacements) {
    if ((out.possible_conditions?.length ?? 0) >= 4) break
    if (!out.possible_conditions?.some((c) => c.toLowerCase() === item.toLowerCase())) {
      out.possible_conditions = [...(out.possible_conditions ?? []), item]
    }
  }
  out.possible_conditions = out.possible_conditions?.slice(0, 4) ?? []

  if (clusterLikely && severityRank(out.severity_level) < severityRank('severe')) {
    out.severity_level = 'severe'
  }

  out.recommended_specialty_slug = 'neurology'
  out.recommended_specialty = 'Neurologist'

  const IRRELEVANT_FOR_SEIZURE =
    /sleep deprivation|nutritional deficiency|anemia\b|^stress$|sarcoma|tumor/i

  out.possible_conditions = (out.possible_conditions ?? []).filter(
    (c) => !IRRELEVANT_FOR_SEIZURE.test(c.trim()) && !BREAKTHROUGH_CONDITION.test(c)
  )

  if (severityRank(out.severity_level) < severityRank('moderate')) {
    out.severity_level = 'moderate'
  }

  const badFlags = (out.red_flags ?? []).some((f) =>
    isGarbledAnalysisLine(f, userText) || /samasya|doraay ka andaza/i.test(f)
  )
  if (badFlags || (out.red_flags?.length ?? 0) < 2) {
    out.red_flags = [
      'One seizure lasting more than 5 minutes',
      'Repeated seizures without waking fully between episodes',
      'Injury during a seizure or trouble breathing after',
      'Call Rescue 1122 or Edhi 115 in an emergency',
    ]
  }

  const badTips = (out.first_aid_tips ?? []).some((t) =>
    /samasya|bina dawai key|jhank|hospital ya clinic mein jaa kar samasya/i.test(t)
  )
  if (badTips || (out.first_aid_tips?.length ?? 0) < 2) {
    out.first_aid_tips = [
      'Seizure ke dauran shakhs ko side par litaein; mun mein chamach ya ungli na dalein',
      'Sar ke neeche naram takiya rakhein; qareeb ki tez ya sakht cheezein door karein',
      'Dora kitni der raha hai note karein',
      'Khud se koi anti-seizure dawai shuru na karein — doctor ke mashware ke baghair',
      'Foran neurologist ya emergency agar dora 5 minute se zyada ho',
    ]
  }

  const seizureSummary = buildSeizureRomanUrduSummary(userText)
  if (seizureSummary) {
    out.urdu_summary = seizureSummary
  } else if (out.urdu_summary) {
    out.urdu_summary = polishPakistaniRomanUrdu(out.urdu_summary)
    if (looksLikeHindiRomanUrdu(out.urdu_summary)) {
      const fallback = buildSeizureRomanUrduSummary(userText)
      if (fallback) out.urdu_summary = fallback
    }
  }

  if (out.explanation) {
    out.explanation = polishPakistaniRomanUrdu(
      out.explanation.replace(/\bneuron specialist\b/gi, 'neurologist')
    )
  }
}

/** Malaria/dengue without real fever; gastro when liver/jaundice is the story. */
function applyYellowFeverPakistanRules(out: SymptomAnalysis, userText: string): void {
  const t = userText.toLowerCase()
  if (!/yellow fever/i.test(t)) return

  const signalText = textForInfectionSignals(t)
  const hasRealFever = /\bfever\b|بخار|high temperature|bukhar/i.test(signalText)
  const noEndemicTravel =
    /no travel|haven'?t traveled|not traveled/i.test(t) ||
    (/travel|africa|south america/i.test(t) && /\bno\b/i.test(t))

  if (!hasRealFever) {
    out.possible_conditions = (out.possible_conditions ?? []).filter(
      (c) => !/^(malaria|dengue|typhoid)$/i.test(c.trim()) && !/^dengue fever$/i.test(c.trim())
    )
  }

  const hasJaundiceUser = /jaundice|yellowing|یرقان|yellow (skin|eyes)/i.test(t)
  if (hasJaundiceUser || /hepatitis|liver|gall|یرقان|jigar|جگر/i.test(
    `${out.primary_condition} ${out.brief_summary} ${out.explanation}`
  )) {
    if (out.recommended_specialty_slug === 'general') {
      out.recommended_specialty_slug = 'gastroenterology'
      out.recommended_specialty = 'Gastroenterologist'
    }
  }

  if (noEndemicTravel && !hasJaundiceUser && out.primary_condition) {
    if (/^yellow fever$/i.test(out.primary_condition.trim())) {
      out.primary_condition = 'Symptoms need medical evaluation (Yellow Fever virus unlikely in Pakistan)'
    }
  }
}

/** User often says "yellow fever" meaning jaundice — avoid arboviral Yellow Fever labels. */
function applyJaundiceVsYellowFeverFix(out: SymptomAnalysis, userText: string): void {
  const t = userText.toLowerCase()
  const hasJaundice = /jaundice|yellowing|یرقان|yellow.*(skin|eyes)|icterus/i.test(t)
  const deniedFever = /\bno fever\b|without fever|بخار نہیں/i.test(t)
  const saidYellowFever = /yellow fever/i.test(t)
  const travelRisk = /yellow fever.*(travel|africa|south america|mosquito|vaccine)/i.test(t)

  const likelyJaundiceNotDisease =
    (hasJaundice || (saidYellowFever && deniedFever)) && !travelRisk

  if (!likelyJaundiceNotDisease) return

  const arboviral = /^yellow fever$/i
  if (out.primary_condition && arboviral.test(out.primary_condition.trim())) {
    out.primary_condition = 'Jaundice (yellowing of skin or eyes)'
  }
  if (out.brief_summary && arboviral.test(out.brief_summary)) {
    out.brief_summary = 'Yellowing of the skin or eyes (jaundice) — needs medical evaluation.'
  }
  out.possible_conditions = (out.possible_conditions ?? []).filter(
    (c) => !arboviral.test(c.trim()) || /hepatitis|jaundice|liver|gall/i.test(c)
  )
}

function severityRank(s: SeverityLevel): number {
  const order: SeverityLevel[] = ['mild', 'moderate', 'severe', 'emergency']
  return order.indexOf(s)
}

const DISCLAIMER_PK =
  'This is health guidance only, not a medical diagnosis. Please consult a qualified doctor in Pakistan.'

/** Skip slow multi-provider LLM when conversation already names a known condition. */
export function shouldUseGuidedFastPath(
  userLines: string[],
  analysisText: string
): boolean {
  if (userLines.length < 2) return false
  const substantive = userLines.filter((l) => l.trim().length >= 12).length
  if (substantive < 2) return false
  return buildGuidedFallbackAnalysis(analysisText) !== null
}

/**
 * Last-resort structured analysis when all LLM providers fail (e.g. Groq tool errors).
 */
export function buildGuidedFallbackAnalysis(userText: string): SymptomAnalysis | null {
  if (isAnaphylaxisContext(userText)) {
    return applySafetyRules(
      {
        primary_condition: 'Possible anaphylaxis (severe allergic reaction)',
        condition_confidence: 'high',
        brief_summary:
          'Sudden lip/face swelling, itching, and difficulty breathing after food — treat as emergency.',
        possible_conditions: [
          'Anaphylaxis (severe allergic reaction)',
          'Food allergy (e.g. peanuts)',
        ],
        recommended_specialty: 'Emergency — go to hospital now',
        recommended_specialty_slug: 'general',
        severity_level: 'emergency',
        explanation: buildAnaphylaxisEnglishExplanation(),
        first_aid_tips: [
          'Call Rescue 1122 or Edhi 115 immediately',
          'Use epinephrine auto-injector (EpiPen) if available',
          'Lay flat with legs raised unless vomiting or breathing is very difficult',
          'Do not eat or drink anything',
          'Go to the nearest emergency hospital — do not wait',
        ],
        red_flags: [
          'Difficulty breathing or throat tightness worsening',
          'Swelling spreading to throat or tongue',
          'Dizziness, collapse, or confusion',
          'Call Rescue 1122 or Edhi 115 now',
        ],
        disclaimer: DISCLAIMER_PK,
        urdu_summary: buildAnaphylaxisRomanUrduSummary(userText),
      },
      userText
    )
  }

  if (ACROMEGALY_CONTEXT.test(userText)) {
    const urdu =
      buildAcromegalyRomanUrduSummary(userText) ??
      'Haath/chehra barhna aur sar dard endocrine masle ki taraf ishara karta hai — endocrinologist se milain.'
    return applySafetyRules(
      {
        primary_condition: 'Possible acromegaly',
        condition_confidence: 'medium',
        brief_summary:
          'Enlarging hands/face and recurring headaches over months — needs endocrinologist evaluation.',
        possible_conditions: ['Acromegaly (growth hormone excess — needs IGF-1 tests)'],
        recommended_specialty: 'Endocrinologist',
        recommended_specialty_slug: 'endocrinology',
        severity_level: 'moderate',
        explanation: buildAcromegalyEnglishExplanation(),
        first_aid_tips: [
          'Book an endocrinologist appointment soon',
          'Do not start hormone medicines without specialist advice',
          'Note shoe size or ring tightness changes',
          'Keep a simple headache diary',
        ],
        red_flags: [
          'Sudden severe headache with vision problems',
          'Chest pain or severe shortness of breath',
          'Confusion or weakness on one side',
          'Call Rescue 1122 or Edhi 115 in an emergency',
        ],
        disclaimer: DISCLAIMER_PK,
        urdu_summary: urdu,
      },
      userText
    )
  }

  if (SEIZURE_CONTEXT.test(userText)) {
    const urdu =
      buildSeizureRomanUrduSummary(userText) ??
      'Doray ho sakte hain — neurologist se jaldi check karwaein.'
    return applySafetyRules(
      {
        primary_condition: 'Possible seizures (doray)',
        condition_confidence: 'medium',
        brief_summary: 'Repeated seizures or loss of control need urgent neurology assessment.',
        possible_conditions: ['Possible seizure disorder — needs neurologist evaluation'],
        recommended_specialty: 'Neurologist',
        recommended_specialty_slug: 'neurology',
        severity_level: 'moderate',
        explanation: buildSeizureEnglishExplanation(),
        first_aid_tips: [
          'During a seizure, lay the person on their side; do not put anything in the mouth',
          'Note how long each episode lasts',
          'Do not start anti-seizure medicine without a doctor',
        ],
        red_flags: [
          'Seizure lasting more than 5 minutes',
          'Repeated seizures without recovery between episodes',
          'Call Rescue 1122 or Edhi 115 in an emergency',
        ],
        disclaimer: DISCLAIMER_PK,
        urdu_summary: urdu,
      },
      userText
    )
  }

  if (isAllergicRhinitisPattern(userText)) {
    return buildAllergieGuidedAnalysis(userText)
  }

  if (isPalpitationsPattern(userText)) {
    return applySafetyRules(
      {
        primary_condition: 'Stress- or caffeine-related palpitations',
        condition_confidence: 'medium',
        brief_summary:
          'Brief fast heartbeat with stress, tea, or poor sleep — often benign but needs a doctor check and possibly ECG.',
        possible_conditions: [
          'Anxiety- or stress-related palpitations',
          'Caffeine-triggered tachycardia',
          'Benign palpitations (ECG recommended)',
        ],
        recommended_specialty: 'Cardiologist or General Physician',
        recommended_specialty_slug: 'cardiology',
        severity_level: 'mild',
        explanation: buildPalpitationsEnglishExplanation(),
        first_aid_tips: [
          'Cut down tea/coffee, especially before exams',
          'Slow deep breathing when heartbeat races',
          'Improve sleep routine',
          'See a GP or cardiologist for ECG if episodes continue',
        ],
        red_flags: [
          'Chest pain or pressure with fast heartbeat',
          'Fainting or severe dizziness',
          'Breathlessness at rest',
          'Call Rescue 1122 or Edhi 115 in an emergency',
        ],
        disclaimer: DISCLAIMER_PK,
        urdu_summary: buildPalpitationsRomanUrduSummary(userText) ?? '',
      },
      userText
    )
  }

  if (hasFeverSignals(userText)) {
    return applySafetyRules(
      {
        primary_condition: 'Fever — needs medical assessment',
        condition_confidence: 'medium',
        brief_summary:
          'Fever with other symptoms needs a GP visit and blood tests (CBC, typhoid; malaria/dengue if appropriate).',
        possible_conditions: [
          'Viral fever or flu-like illness',
          'Typhoid (needs blood tests)',
          'Malaria (needs blood smear or rapid test)',
        ],
        recommended_specialty: 'General Physician',
        recommended_specialty_slug: 'general',
        severity_level: 'moderate',
        explanation: buildFeverEnglishExplanation(userText),
        first_aid_tips: [
          'Plenty of fluids and rest',
          'Paracetamol only as directed — avoid random antibiotics',
          'Note highest temperature and any rash',
          'Book a GP visit within 1–2 days',
        ],
        red_flags: [
          'Fever above 39°C lasting more than 3 days',
          'Severe dehydration, confusion, or difficulty breathing',
          'Call Rescue 1122 or Edhi 115 in an emergency',
        ],
        disclaimer: DISCLAIMER_PK,
        urdu_summary: buildFeverRomanUrduSummary(userText) ?? '',
      },
      userText
    )
  }

  return null
}

function buildAllergieGuidedAnalysis(userText: string): SymptomAnalysis {
  const english =
    isEnglishUserText(userText) ||
    (/\b(sneez|runny nose|itchy eyes|outdoor|antihistamine|morning)\b/i.test(userText) &&
      !isRomanUrduText(userText))

  return applySafetyRules(
    {
      primary_condition: 'Allergic rhinitis (hay fever)',
      condition_confidence: 'medium',
      brief_summary:
        'Sneezing, runny nose, and itchy eyes — worse outdoors or in dust — fit allergic rhinitis. Usually mild; see a doctor if breathing is difficult.',
      possible_conditions: [
        'Allergic rhinitis (hay fever)',
        'Dust or pollen allergy',
        'Seasonal nasal allergy',
      ],
      recommended_specialty: 'ENT Specialist or General Physician',
      recommended_specialty_slug: 'ent',
      severity_level: 'mild',
      explanation:
        'Your symptoms are consistent with allergic rhinitis (hay fever), often triggered by dust, pollen, or morning allergen exposure. This is not a fever illness. Avoid triggers where possible, try saline nose rinses, and consider an over-the-counter antihistamine such as cetirizine or loratadine if you have used one safely before. See a GP or ENT specialist if symptoms persist or breathing becomes difficult.',
      first_aid_tips: [
        'Avoid dusty or windy outdoor areas; wear a mask during high pollen or dust',
        'Saline nasal rinse or steam may ease a blocked or runny nose',
        'Antihistamine (cetirizine or loratadine) may help — ask a pharmacist if unsure',
        'Keep windows closed on high-wind days; wash bedding if dust mites may be a trigger',
        'See a doctor if breathing difficulty or symptoms last beyond a few weeks',
      ],
      red_flags: [
        'Difficulty breathing or wheezing',
        'Facial swelling or lip swelling',
        'High fever with severe headache or rash',
        'Call Rescue 1122 or Edhi 115 in an emergency',
      ],
      disclaimer: DISCLAIMER_PK,
      urdu_summary: english
        ? ''
        : isRomanUrduText(userText)
          ? 'Aap ke symptoms allergic rhinitis (hay fever) ki taraf ishara karte hain — dust/pollen se trigger ho sakte hain. Yeh bukhar ki bimari nahi. Dust se bachain, antihistamine pharmacist se pooch kar le sakte hain, aur agar saans mein dikkat ho to ENT ya GP se milain.'
          : 'آپ کی علامات الرجک رائنائٹس (ہے فیور) کی طرف اشارہ کرتی ہیں۔',
    },
    userText
  )
}

/** Rule-based follow-up when all LLM providers fail mid-triage. */
export function buildGuidedFollowUpFallback(
  userLines: string[],
  assistantLines: string[],
  language: 'en' | 'ur'
): { message: string; quick_severity: 'mild' | 'moderate' | 'severe' | 'emergency' } | null {
  const userText = userLines.join(' ')
  const asked = assistantLines.join(' ').toLowerCase()

  if (isAllergicRhinitisPattern(userText)) {
    const context = `${asked} ${userText.toLowerCase()}`
    if (!/antihistamine|cetirizine|loratadine|not taken|have not taken/i.test(context)) {
      return {
        message:
          language === 'en'
            ? 'Have you tried any antihistamine such as cetirizine or loratadine for these symptoms?'
            : 'Kya aapne cetirizine ya loratadine jaisi antihistamine try ki hai?',
        quick_severity: 'mild',
      }
    }
    if (!/outdoor|outside|dust|wind|pollen/i.test(context)) {
      return {
        message:
          language === 'en'
            ? 'Do your symptoms get worse outdoors or in dusty or windy places?'
            : 'Kya bahar ya dust/wind mein symptoms zyada hoti hain?',
        quick_severity: 'mild',
      }
    }
    if (!/morning|wake|subah|evening/i.test(context)) {
      return {
        message:
          language === 'en'
            ? 'Are your symptoms worst when you wake up in the morning?'
            : 'Kya subah uthte hi symptoms zyada hoti hain?',
        quick_severity: 'mild',
      }
    }
    if (!/seasonal|year.?round|all year/i.test(context)) {
      return {
        message:
          language === 'en'
            ? 'Are your symptoms seasonal at certain times of year, or present all year?'
            : 'Kya symptoms kuch mausamon mein zyada hoti hain ya saal bhar?',
        quick_severity: 'mild',
      }
    }
    if (!/pet|cat|dog|mold|carpet|bedding/i.test(context)) {
      return {
        message:
          language === 'en'
            ? 'Do you have pets, carpets, or dusty bedding at home that might trigger symptoms?'
            : 'Ghar mein pets, carpet, ya dusty bedding hai jo trigger ho sakti hai?',
        quick_severity: 'mild',
      }
    }
    return null
  }

  if (hasFeverSignals(userText) && !/rash|temperature|thermometer|degree/i.test(asked)) {
    return {
      message:
        language === 'en'
          ? 'Have you measured your temperature with a thermometer, and was there any rash?'
          : 'Thermometer par kitna bukhar aata hai, aur koi daaney ya khujli hui?',
      quick_severity: 'moderate',
    }
  }

  return null
}
