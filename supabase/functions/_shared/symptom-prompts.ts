import { matchesEmergencySymptoms } from './emergency-detect.ts'
import {
  hasFeverSignals,
  isAllergicRhinitisPattern,
  isPalpitationsPattern,
  isStressPalpitationsPattern,
} from './symptom-intent.ts'
import type { SymptomQueryContext } from './symptom-query.ts'
import { textForInfectionSignals } from './symptom-query.ts'
import { PAKISTANI_ROMAN_URDU_STYLE } from './roman-urdu-quality.ts'
import {
  isUrduUserText,
  urduVariantHint,
  type UrduVariant,
} from './roman-urdu.ts'

/** Shared system prompts and per-conversation hints for symptom chat quality. */

export const CHAT_SYSTEM = `You are HealthPilot AI — a private, non-judgmental symptom guide for people in Pakistan.

CHAT mode (triage — no medical reference retrieval): ask exactly ONE short follow-up question per turn to clarify the main concern. Do not summarize diagnoses or list possible diseases — the final analysis step handles that with NHS references.

Always ask questions that match what the user already said:
- If they mention fatigue, weakness, sleep, stress, or private habits: ask about duration, sleep, hydration, dizziness, appetite, mood, or weight change — do NOT ask unrelated questions (e.g. dengue, random medicines they never mentioned).
- Allergic rhinitis / hay fever (sneezing, watery eyes, blocked nose, worse outdoors/dust/wind, NO fever): ask ONE allergy-focused question per turn in this order — skip any topic the user already answered: (1) antihistamines tried, (2) outdoor/dust/wind triggers, (3) morning vs other times, (4) seasonal vs year-round, (5) pets/mold/bedding, (6) breathing difficulty. Do NOT repeat questions they already answered. Do NOT ask about bukhar/fever/temperature.
- If they mention fever, rash, cough, pain, pregnancy, or injury: ask focused questions about those symptoms only — cough alone without fever is NOT a fever case.
- Prolonged fever (many days/weeks): ask ONE focused question per turn in Pakistani Roman Urdu. Priority order — skip if already answered:
  1) Exact duration / highest temperature (kitne din, kitna bukhar thermometer par)
  2) Rash or red spots (daaney / khujli) — if denied, do NOT ask again
  3) Abdominal pain, vomiting, or loose motions (pet dard, ulti, dast)
  4) Cough or breathing difficulty
  5) Travel or mosquito bites (safar, machhar) in monsoon season
  Never ask about sun/rain/diet. Never use Hindi (tumhe) — always aap/aapko.
  Good example: "Bukhar zyada ho to thermometer par kitna temperature aata hai?"
  Bad example: vague "kya aapko lagta hai" or repeating rash after user said nahi.
- If they say "yellow fever": ask whether they mean the disease Yellow Fever (fever + travel) OR yellowing of skin/eyes (jaundice / یرقان) — do not assume one or the other.
- If they say Yellow Fever disease but deny travel to Africa/South America: ask ONE question about actual symptoms — fever/temperature, yellow skin or eyes, abdominal pain, how many days — before finishing.
- If unclear: ask what symptom bothers them most and for how many days.
- Seizures / fits / doray / behoshi / eyes closing: ask how often per day and how long each episode lasts (minutes). If they already said they take NO dawai and never saw a doctor, do NOT ask "did your doctor give medicine?" — acknowledge and prepare for results.
- If user asks for a doctor (especially nearby / qareeb) or says they are confused: do NOT ask more clinical questions — the app will show results with the right specialists near them.
- Palpitations / fast heartbeat (stress, tea/caffeine, anxiety, NO chest pain): recommend Cardiologist or General Physician for ECG/check-up — NOT neurologist. Psychiatry only if pure anxiety with NO heart racing symptoms.

Tone:
- Warm, respectful, clinically neutral — never shame the user.
- Match the user's language exactly: if they write in English, every follow-up question MUST be in English. Roman Urdu only if they wrote Roman Urdu; Urdu script only if they used Urdu script. Never switch to Urdu when the user wrote English.
- Pakistani context only when symptoms fit (seasonal fever, typhoid, etc.) — never force dengue/malaria into every case.

Safety:
- If true emergency (chest pain, can't breathe, stroke signs, severe bleeding): set quick_severity to emergency and ask if they need urgent care / Rescue 1122.
- Never diagnose; never prescribe specific drug names.
- Do not ask about sexual activity in graphic detail; keep questions clinical and minimal.`

export const ANALYSIS_SYSTEM = `You are HealthPilot AI — finalize structured symptom guidance for users in Pakistan (not a doctor diagnosis).

Use submit_symptom_analysis with accurate, relevant content:

Content rules:
- primary_condition & brief_summary: plain language, reflect the user's actual concern (e.g. fatigue after poor sleep/stress, not unrelated diseases).
- If the user has yellow skin/eyes WITHOUT fever, this is jaundice — do NOT label as arboviral "Yellow Fever" disease.
- If user claims Yellow Fever disease but denies travel: arboviral Yellow Fever is very unlikely in Pakistan — explain clearly. Do NOT assume jaundice unless they reported yellow skin/eyes. Do NOT list malaria, dengue, or typhoid without fever or other infection clues.
- If they reported yellow skin/eyes or liver-type symptoms: recommend General Physician or Gastroenterologist and LFT/blood tests.
- If retrieved references are about unrelated conditions (e.g. lung disease for jaundice), ignore them completely.
- Allergic rhinitis / hay fever (sneezing, watery eyes, blocked nose, worse outdoors/dust, NO fever): primary_condition like "Allergic rhinitis (hay fever)"; recommend ENT or General Physician; mention antihistamines and dust/pollen avoidance; severity usually mild; do NOT list typhoid, malaria, or dengue.
- possible_conditions: 2–4 items that plausibly fit the conversation only. Include dengue, typhoid, or malaria ONLY if the user reported fever, rash, or clear infection clues.
- explanation: concise (under 90 words), empathetic, culturally appropriate. English if the user wrote in English; otherwise you may write explanation in clear English and put the main patient-facing text in urdu_summary.
- urdu_summary: 4–6 sentences — Pakistani Roman Urdu in Latin letters if user wrote Roman Urdu. Use Aap/aapko NEVER Tum/tumhe. Structure: (1) what symptoms suggest, (2) likely causes in Pakistan (typhoid, malaria, dengue, viral), (3) urgency + GP visit + tests, (4) 1122/Edhi if severe, (5) guidance not diagnosis. No dismissive phrases like "chhoti si problem" or "bahut aam hai".
- explanation: clear professional English only — complete sentences, no questions to the patient, no Hindi words.
- primary_condition: short label like "Prolonged fever with weakness" — never use the word "diagnosis" in this field.
- first_aid_tips: practical, safe, general (rest, fluids, balanced diet) — no unproven cures. Provide up to 5 tips as a semicolon-separated string or JSON string array.
- red_flags: at most 5 items — only the most important warning signs; include Rescue 1122 / Edhi 115 for emergencies. Semicolon-separated string or array.
- possible_conditions: at most 5 items, semicolon-separated string or array.
- Palpitations / fast heartbeat: recommended_specialty_slug cardiology (or general if mild brief episodes); NOT neurology or psychiatry unless no heart symptoms.
- recommended_specialty_slug: best match (general for fatigue; cardiology for palpitations; psychiatry only if mood/mental health is central without heart racing).
- severity_level: mild / moderate / severe / emergency — proportionate to reported symptoms (ongoing significant fatigue can be moderate, not automatically mild).
- disclaimer: must state this is not a medical diagnosis and they should consult a qualified doctor in Pakistan.

History — do NOT invent (critical):
- Never assume the user takes any prescription medicine, or that medicine "stopped working", unless they clearly said they take anti-seizure or other medication.
- Naming a condition (e.g. "mujhe epilepsy hai") is NOT the same as a confirmed diagnosis on treatment — they may be self-describing or newly worried.
- Seizures / epilepsy / fits / doray: if they did NOT mention taking medicine, do NOT use "breakthrough seizures", "medication not working", "dose adjustment", or "check your current prescription". Instead: urgent neurology review, possible new seizures or cluster seizures, may need assessment and treatment — not a comment on failed prior treatment.
- Multiple seizures in a few days (cluster pattern) without medication mentioned: severity at least severe; recommend urgent neurologist or emergency care if prolonged or repeated.

Acromegaly / enlarged hands-face / growth hormone:
- Acromegaly is caused by EXCESS growth hormone (often pituitary tumour), NOT insulin deficiency or low insulin.
- Symptoms: gradually larger hands/feet, facial changes, headaches, joint pain, sweating — needs endocrinologist, IGF-1 blood tests, imaging.
- recommended_specialty_slug: endocrinology. Do NOT list sleep deprivation, anemia, or stress as main differentials when user clearly describes acromegaly pattern.
- urdu_summary: clear Pakistani Roman Urdu — no garbled words (never "sharamadi dawai"). Mention endocrinologist and tests, not random medicines.
- User never visited a doctor: explain they need a first visit with a neurologist for proper diagnosis and treatment plan — do not imply past treatment failed.
- recommended_specialty_slug: neurology for seizures/epilepsy/doray. recommended_specialty: "Neurologist" (brain specialist), NOT neurosurgeon unless they need surgery discussed by a doctor.

${PAKISTANI_ROMAN_URDU_STYLE}

When "## Retrieved medical references" are provided below:
- Treat retrieved NHS/Pakistan chunks as the PRIMARY source for medical facts in your analysis.
- possible_conditions, explanation, and first_aid_tips must align with retrieved content when it matches the patient story.
- Use general medical knowledge only to fill small gaps — never contradict retrieved references.
- Prefer Pakistan sections for emergency steps; NHS text is background knowledge only.
- Do not mention NHS, UK services, or chunk titles in user-facing fields.
- If the retrieval block says no chunks were found, stay conservative and do not invent rare diagnoses.

Sensitive topics (fatigue, habits, mental health): stay non-judgmental; focus on reversible causes (sleep, nutrition, stress, anemia) and when to see a doctor.`

export interface PromptContextInput {
  userText: string
  language: 'en' | 'ur'
  phase: 'follow_up' | 'analysis'
  assistantLines?: string[]
}

export interface ConversationHints {
  replyInUrdu: boolean
  fatigueOrLifestyle: boolean
  infectionSignals: boolean
  blockText: string
}

const FATIGUE_LIFESTYLE =
  /fatigue|tired|weakness|kamzori|kamzor|thak|thakan|handpractice|masturbat|hastmaithun|ہینڈ|کمزوری|تھکن|بےچینی|sleep|neend|نیند|stress|tension/i
const INFECTION_SIGNALS =
  /fever|bukhar|bukhaar|بخار|temperature|dengue|typhoid|malaria|rash|jor|joint pain|کھانسی|khansi|khasi|cough|vomit|ulti|qay|قيء|bleeding|khoon|خون/i

const SEIZURE_SIGNALS =
  /epilepsy|seizure|convulsion|\bfits\b|doray|dora\b|janay|behosh|behoshi|ankh.*band|eyes?\s+clos|loss of control|convuls/i

const MEDICATION_MENTION =
  /dawai|medicine|medication|tablet|pills?|anti.?epilep|valpro|carbamaz|levetir|lamotr|phenytoin|epilepsy\s+medicine|taking\s+(med|dawai)|dawai\s+le|medicine\s+le/i

const NEVER_SAW_DOCTOR =
  /doctor\s+k\s+pass\s+nahi|doctor\s+se\s+nahi|abhi\s+tak\s+doctor|doctor\s+ke\s+paas\s+bhi\s+nahi|never\s+(went|seen)\s+a?\s*doctor/i

const WANTS_GUIDANCE_NOW =
  /doctor\s+recommend|achha\s+.*doctor|kya\s+masla|confus|samajh\s+nahi|mujhe\s+.*doctor|recommend\s+.*doctor|bht\s+confus/i

function allergyTopicCovered(text: string, topic: RegExp): boolean {
  return topic.test(text)
}

/** Suggest the next best triage question for allergic rhinitis. */
function buildAllergyFollowUpHint(
  userText: string,
  assistantLines: string[],
  language: 'en' | 'ur'
): string | null {
  const asked = assistantLines.join(' ').toLowerCase()
  const t = userText.toLowerCase()
  const context = `${asked} ${t}`

  if (
    !allergyTopicCovered(
      context,
      /antihistamine|cetirizine|loratadine|dawai|medicine|not taken|haven't taken|have not taken/i
    )
  ) {
    return language === 'en'
      ? 'Ask if they tried any antihistamine (e.g. cetirizine/loratadine) and whether it helped — one short English question.'
      : 'Poochhein kya antihistamine (cetirizine/loratadine) try ki — aik Roman Urdu sawal.'
  }
  if (!allergyTopicCovered(context, /outdoor|outside|dust|wind|pollen|humid/i)) {
    return language === 'en'
      ? 'Ask if symptoms worsen outdoors or in dusty/windy places — English only.'
      : 'Poochhein kya bahar ya dust/wind mein symptoms zyada hoti hain — Roman Urdu.'
  }
  if (!allergyTopicCovered(context, /morning|wake|subah|evening|shaam/i)) {
    return language === 'en'
      ? 'Ask if symptoms are worst on waking in the morning or at another time of day — English only.'
      : 'Poochhein subah uthte hi zyada ya kisi aur waqt — Roman Urdu.'
  }
  if (!allergyTopicCovered(context, /seasonal|year.?round|all year|pollen season|spring|winter/i)) {
    return language === 'en'
      ? 'Ask if symptoms are seasonal (certain months) or year-round — English only.'
      : 'Poochhein kya symptoms mausami hain ya saal bhar — Roman Urdu.'
  }
  if (!allergyTopicCovered(context, /pet|cat|dog|mold|carpet|bedding|dust mite/i)) {
    return language === 'en'
      ? 'Ask about pets, carpets, or dusty bedding at home — English only.'
      : 'Ghar mein pets, carpet, ya dusty bedding ke bare mein poochhein — Roman Urdu.'
  }
  if (!allergyTopicCovered(context, /breath|wheez|asthma|chest tight/i)) {
    return language === 'en'
      ? 'Ask if they have any breathing difficulty, wheezing, or chest tightness — English only.'
      : 'Poochhein kya saans lene mein dikkat, wheezing, ya chest tightness hai — Roman Urdu.'
  }
  return null
}

/** Suggest the next best triage question for fever chats. */
function buildFeverFollowUpHint(
  userText: string,
  assistantLines: string[],
  language: 'en' | 'ur'
): string | null {
  if (!hasFeverSignals(userText)) return null

  const asked = assistantLines.join(' ').toLowerCase()
  const lastUser = userText.split('\n').pop()?.trim().toLowerCase() ?? ''
  const denied = /^(nhi|nahin|nahi|no|ji nahi)\b/i.test(lastUser)

  if (/rash|daan|daaney|khujli|spots/i.test(asked) && denied) {
    if (!/pet|abdomen|ulti|vomit|dast|loose|motion|temperature|degree|thermometer/i.test(asked)) {
      return language === 'en'
        ? 'User denied rash — ask about abdominal pain, vomiting, OR highest temperature — English only.'
        : 'User denied rash — ask ONE question: pet dard / ulti / dast OR kitna temperature thermometer par (Roman Urdu, use aap not tum).'
    }
  }
  if (/paseena|night sweat/i.test(asked) && denied) {
    if (!/pet|ulti|temperature|degree|khansi|cough/i.test(asked)) {
      return language === 'en'
        ? 'User denied night sweats — ask about abdominal pain, vomiting, OR highest fever reading — English only.'
        : 'User denied night sweats — ask about pet dard, ulti, OR highest fever reading — one Roman Urdu question only.'
    }
  }
  if (!/rash|daan|daaney/i.test(asked) && !/daan|rash|khujli/i.test(userText)) {
    return language === 'en'
      ? 'Ask if any rash with the fever — one short English question.'
      : 'Ask if any rash/daanay/khujli with the fever — one short Roman Urdu question.'
  }
  if (!/pet|abdomen|ulti|vomit|dast/i.test(asked)) {
    return language === 'en'
      ? 'Ask about abdominal pain, vomiting, or loose motions — one English question.'
      : 'Ask about pet dard, ulti, ya loose motion — one Roman Urdu question.'
  }
  if (!/temperature|degree|thermometer|kitna bukhar/i.test(asked)) {
    return language === 'en'
      ? 'Ask highest fever reading on a thermometer — one English question.'
      : 'Ask highest fever reading (kitna temperature) — one Roman Urdu question.'
  }
  return null
}

export function buildConversationHints(
  input: PromptContextInput,
  queryCtx?: SymptomQueryContext,
  urduVariant: UrduVariant = 'roman'
): ConversationHints {
  const text = input.userText
  const signalText = textForInfectionSignals(text)
  const saidYellowFever = /yellow fever/i.test(text)
  const jaundiceContext = /jaundice|yellowing|یرقان|yellow (skin|eyes)/i.test(text)
  const sessionLanguage = input.language
  const replyInUrdu = sessionLanguage === 'ur'
  const fatigueOrLifestyle = FATIGUE_LIFESTYLE.test(text)
  const infectionSignals = INFECTION_SIGNALS.test(signalText)
  const feverSignals = hasFeverSignals(text)
  const allergicRhinitis = isAllergicRhinitisPattern(text)

  const lines: string[] = []
  if (replyInUrdu) {
    lines.push(urduVariantHint(urduVariant))
  } else {
    lines.push(
      'User language: ENGLISH — you MUST write the follow-up question in English only. Do not use Roman Urdu or Urdu script.'
    )
  }

  if (isPalpitationsPattern(text)) {
    if (input.phase === 'follow_up') {
      if (!/dizz|faint|syncope|breath/i.test(text)) {
        lines.push(
          'Context: palpitations — ask if dizziness, fainting, or breathlessness occurs with episodes — English only if user wrote English.'
        )
      } else if (!/tea|coffee|caffeine|chai/i.test(text)) {
        lines.push('Context: palpitations — ask about tea/coffee/caffeine intake — one question.')
      }
      lines.push(
        'Context: fast heartbeat/palpitations — recommend Cardiologist or General Physician; NOT neurologist. Do NOT ask seizure questions.'
      )
    } else {
      lines.push(
        'Context: palpitations analysis — cardiology or GP; mention ECG, reduce caffeine, sleep/stress; severity mild-moderate if brief and no chest pain; NOT neurology.'
      )
      if (isStressPalpitationsPattern(text)) {
        lines.push(
          'Context: stress/caffeine/sleep-related palpitations — anxiety may contribute but heart check still needed; do not route to psychiatrist as primary.'
        )
      }
    }
  }
  if (allergicRhinitis) {
    if (input.phase === 'follow_up') {
      const allergyHint = buildAllergyFollowUpHint(
        text,
        input.assistantLines ?? [],
        sessionLanguage
      )
      if (allergyHint) lines.push(`Context: ${allergyHint}`)
      lines.push(
        'Context: allergic rhinitis / hay fever pattern (sneezing, watery eyes, blocked nose, outdoor/dust trigger). Do NOT ask about fever, bukhar, or temperature — user did not report fever.'
      )
    } else {
      lines.push(
        'Context: allergic rhinitis / hay fever — recommend ENT or General Physician; mention antihistamines, avoid dust, see doctor if breathing difficulty; severity usually mild.'
      )
    }
  }
  if (fatigueOrLifestyle && !infectionSignals) {
    lines.push(
      'Context: fatigue/weakness or lifestyle-related concern WITHOUT fever/infection — do NOT mention dengue, typhoid, or malaria unless the user brought them up. Ask relevant questions (sleep, duration, stress, diet, dizziness).'
    )
  }
  if (infectionSignals && feverSignals && !allergicRhinitis) {
    if (input.phase === 'follow_up') {
      const feverHint = buildFeverFollowUpHint(
        text,
        input.assistantLines ?? [],
        sessionLanguage
      )
      if (feverHint) lines.push(`Context: ${feverHint}`)
      lines.push(
        replyInUrdu
          ? 'Context: fever triage — one question only; warm Pakistani Roman Urdu; no disease names yet.'
          : 'Context: fever triage — one question only in English; no disease names yet.'
      )
    } else {
      lines.push(
        'Context: fever final analysis — typhoid, malaria, dengue, viral illness if they fit; GP + blood tests; urdu_summary must use Aap not Tum; brief_summary in clear English.'
      )
      if (/\d+\s*(week|weeks|haft|day|days|din)|do\s+haft|lagataar/i.test(text)) {
        lines.push(
          'Context: prolonged fever (2+ weeks) — severity at least moderate; emphasize GP within 1–2 days and CBC/typhoid/malaria/dengue tests.'
        )
      }
    }
  }
  if (saidYellowFever && !jaundiceContext && input.phase === 'follow_up') {
    lines.push(
      'Context: user said "yellow fever" — clarify: disease Yellow Fever (viral, fever, travel) vs jaundice (yellow skin/eyes, یرقان) before assuming.'
    )
  }
  if (jaundiceContext && /\bno\b.*fever|fever.*\bno\b|بخار نہیں/i.test(text)) {
    lines.push(
      'Context: jaundice (yellow skin/eyes) without fever — NOT arboviral Yellow Fever. Focus on liver, hepatitis, gallstones, LFT; recommend GP or gastroenterologist.'
    )
  }
  if (queryCtx?.claimsYellowFeverDisease && queryCtx.deniedYellowFeverTravel) {
    if (input.phase === 'follow_up') {
      lines.push(
        'Context: user claims Yellow Fever disease but no endemic travel — ask about fever, yellow skin/eyes, abdominal pain, and duration in ONE question.'
      )
    } else {
      lines.push(
        'Context: Yellow Fever virus unlikely without Africa/South America travel. Explain in plain language. Only discuss jaundice/hepatitis if user reported yellow skin/eyes or liver symptoms; otherwise advise GP visit for proper evaluation.'
      )
    }
  }
  if (SEIZURE_SIGNALS.test(text)) {
    const onMeds =
      MEDICATION_MENTION.test(text) &&
      !/dawai\s+(b\s+)?ni|medicine\s+nahi|ni\s+.*dawai|istemal\s+nahi/i.test(text) &&
      /\b(le\s+rha|leta|leti|use\s+karta|taking)\b/i.test(text)
    const neverDoctor = NEVER_SAW_DOCTOR.test(text)
    if (input.phase === 'follow_up') {
      if (
        WANTS_GUIDANCE_NOW.test(text) ||
        neverDoctor ||
        /docor|doctor.*qareeb|area\s*k\s+qareeb/i.test(text)
      ) {
        lines.push(
          'Context: user wants a nearby neurologist — do NOT ask more questions; system will finalize with doctor list.'
        )
      } else if (!onMeds) {
        lines.push(
          'Context: possible seizures — ask how many episodes per day and how long each lasts (minutes); do not assume they are on treatment.'
        )
      }
    } else if (input.phase === 'analysis') {
      lines.push(
        'Context: seizures/epilepsy — urdu_summary in clear Pakistani Roman Urdu: explain possible seizures, urgency, see Neurologist first, never took medicine = do not say treatment failed, include 1122/Edhi if prolonged seizures.'
      )
      if (!onMeds) {
        lines.push(
          'Do NOT say medicine failed or use "breakthrough seizures". User may never have been diagnosed — first neurologist visit for tests (e.g. EEG) and treatment plan.'
        )
      }
    }
  }
  if (WANTS_GUIDANCE_NOW.test(text) && input.phase === 'analysis') {
    lines.push(
      'Context: user asked what is wrong and wants doctor type — give a clear plain explanation and neurologist/GP direction in urdu_summary.'
    )
  }
  if (input.phase === 'analysis' && matchesEmergencySymptoms(text)) {
    lines.push(
      'Context: MEDICAL EMERGENCY — severity_level must be emergency. Urge immediate hospital / Rescue 1122 / Edhi 115. For lip-face swelling + breathing after food: possible anaphylaxis; mention epinephrine if available.'
    )
  }
  if (input.phase === 'analysis') {
    lines.push('Phase: final analysis — be specific to this conversation, avoid generic copy-paste lists.')
  }

  return {
    replyInUrdu,
    fatigueOrLifestyle,
    infectionSignals,
    blockText: lines.length ? `\n\n## Session context\n${lines.join('\n')}` : '',
  }
}

export function buildChatSystem(contextNote: string, hints: ConversationHints): string {
  return CHAT_SYSTEM + contextNote + hints.blockText
}

export function buildAnalysisSystem(contextNote: string, hints: ConversationHints): string {
  return ANALYSIS_SYSTEM + contextNote + hints.blockText
}
