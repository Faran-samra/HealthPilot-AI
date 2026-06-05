/**
 * Pakistani Roman Urdu quality — avoid Hindi-style wording in patient-facing text.
 */

import { isRomanUrduText } from './roman-urdu.ts'

/** Hint block for LLM system prompts. */
export const PAKISTANI_ROMAN_URDU_STYLE = `Roman Urdu must be Pakistani (Lahore/Karachi/Islamabad) — NOT Hindi.
Use: masla, takleef, takreeban, mashwara, foran, jaldi, neurologist, dora/doray, behoshi, hospital, check-up, dawai, ilaj.
Avoid Hindi words: samasya, lagbhag, samay, khayen, janch/jhankna, shikar, kripya, swasthya, aas-paas ke samasya karein, neuron specialist.
Write short clear sentences. No garbled or mixed Hindi-Urdu.`

const HINDI_MARKERS =
  /\b(samasya|lagbhag|samay|khayen|jhanknay|jhankna|shikaarpurn|kripya|swasthya|neuron\s+specialist|aas\s+paas\s+ke\s+hospital\s+ya\s+clinic\s+mein\s+jaa\s+kar\s+samasya|tumhe|tumhein|tumko|dekhbhaal|dekh\s*bhaal)\b/i

const REPLACEMENTS: [RegExp, string][] = [
  [/\btumhe\b/gi, 'aapko'],
  [/\btumhein\b/gi, 'aapko'],
  [/\btumko\b/gi, 'aapko'],
  [/\bsamasya\b/gi, 'masla'],
  [/\blagbhag\b/gi, 'takreeban'],
  [/\bsamay\b/gi, 'waqt'],
  [/\bkhayen\b/gi, 'khayein'],
  [/\bjhanknay\b/gi, 'check karwana'],
  [/\bjhankhee\b/gi, 'check-up'],
  [/\bshikaarpurn\b/gi, 'experienced'],
  [/\bneuron specialist\b/gi, 'neurologist'],
  [/\baas paas ke hospital ya clinic mein jaa kar samasya karein\b/gi, 'qareeb hospital ya clinic mein jaldi check karwaein'],
  [/\bIssey pahle\b/gi, 'Pehle'],
  [/\bkisi bhi tarah ki dawai ni khayen\b/gi, 'khud se koi dawai shuru na karein'],
]

export function looksLikeHindiRomanUrdu(text: string): boolean {
  return HINDI_MARKERS.test(text)
}

export function polishPakistaniRomanUrdu(text: string): string {
  let s = text
  for (const [pattern, replacement] of REPLACEMENTS) {
    s = s.replace(pattern, replacement)
  }
  return s.replace(/\s{2,}/g, ' ').trim()
}

const SEIZURE_CONTEXT =
  /epilepsy|seizure|doray|dora\b|fits|behosh|chakkar|chakar|control\s+nhi/i

/** Fallback patient summary when model outputs poor Hindi-style Roman Urdu. */
export function buildSeizureRomanUrduSummary(userText: string): string | null {
  if (!SEIZURE_CONTEXT.test(userText)) return null
  if (!isRomanUrduText(userText) && !/\b(mujhe|mera|nahi|ni)\b/i.test(userText)) return null

  const noMeds = /dawai\s+(b\s+)?ni|koi\s+dawai\s+nahi|medicine\s+nahi/i.test(userText)
  const noDoctor = /doctor\s+k\s+pass\s+nahi|doctor\s+se\s+nahi|abhi\s+tak\s+doctor/i.test(userText)
  const freq = /2\s*se\s*3|2-3|teen\s+bar|2\s+ya\s+3/i.test(userText)
  const duration = /3\s*se\s*5|3-5\s*minute/i.test(userText)
  const days = /5\s+din|pichle\s+\d+\s+din/i.test(userText)

  let summary =
    'Aap ke alfaz se lagta hai ke aap ko seizure (dora) ho sakte hain — yeh epilepsy jaisa masla ho sakta hai, lekin sirf doctor hi confirm karta hai. '

  if (days) {
    summary += 'Pichle kuch dinon se doray hona fikar ki baat hai. '
  }
  if (freq && duration) {
    summary += 'Din mein 2-3 dafaa aur har dora takreeban 3-5 minute tak rehna normal nahi — jaldi neurologist se milna chahiye. '
  } else if (freq) {
    summary += 'Din mein baar baar doray hona urgent hai. '
  }

  if (noMeds || noDoctor) {
    summary +=
      'Aap ne bataya ke abhi tak doctor ya dawai nahi — khud se medicine mat lein; pehli dafa neurologist (brain specialist) se check-up karwaein. '
  }

  summary +=
    'Neurologist EEG ya tests ke baad batayega ke epilepsy hai ya koi aur wajah. Agar dora 5 minute se zyada ho, lagatar doray aayein, ya behoshi zyada ho to foran Rescue 1122 / Edhi 115 ya emergency hospital jayein. '

  if (/doctor|docor|qareeb|suggest|recommend|area/i.test(userText)) {
    summary +=
      'Neeche aap ke sheher ke neurologists ki list hai — "Doctors near me" ya GPS on karke sab se qareeb doctor choose karein. '
  }

  summary += 'Yeh sirf rehnumai hai — doctor hi sahi tashkhees karega.'

  return summary
}

const CLEAR_SEIZURE_EXPLANATION_EN =
  'Repeated seizures (doray/fits) should be assessed by a neurologist as soon as possible. Common causes include epilepsy and other brain conditions; tests such as an EEG help confirm. If a seizure lasts more than five minutes, repeats back-to-back, or causes serious injury, call Rescue 1122 or Edhi 115 or go to emergency. This is guidance only, not a diagnosis.'

export function buildSeizureEnglishExplanation(): string {
  return CLEAR_SEIZURE_EXPLANATION_EN
}

const PALPITATIONS_CONTEXT =
  /heart\s+beat(ing)?\s*(fast|quick|racing)|racing\s+heart|palpitation|tachycardia|dharkan\s+tez/i

export function buildPalpitationsRomanUrduSummary(userText: string): string | null {
  if (!PALPITATIONS_CONTEXT.test(userText)) return null
  if (!isRomanUrduText(userText) && !/\b(I have|my heart|stress|anxious)\b/i.test(userText)) {
    return null
  }

  return (
    'Aap ki tez dharkan stress, chai/caffeine, ya neend ki kami se ho sakti hai. ' +
    'Chest pain ya behoshi nahi hone par aksar ye mild hoti hai, lekin ECG ke liye General Physician ya Cardiologist se check-up zaroori hai. ' +
    'Khud se dawai mat shuru karein. Agar seene mein dard, behoshi, ya saans ki dikkat ho to foran hospital ya Rescue 1122 / Edhi 115.'
  )
}

export function buildPalpitationsEnglishExplanation(): string {
  return (
    'Brief fast heartbeat with stress, exams, tea/caffeine, or poor sleep is often anxiety- or caffeine-related palpitations, but a doctor should still check with history and possibly an ECG. ' +
    'See a General Physician or Cardiologist — not a neurologist unless you have seizures or fainting spells. ' +
    'Seek emergency care if chest pain, severe breathlessness, fainting, or symptoms lasting more than a few minutes occur.'
  )
}

export function isGarbledAnalysisLine(text: string, userText: string): boolean {
  const t = text.trim()
  if (t.length < 3) return true
  if (t.length > 72) return true
  if (/sarcoma|tumor/i.test(t) && !/tumor|sarcoma|mass|lump|gaanth/i.test(userText)) return true
  if (/ke baad|ho sakati|ho sakta|khane ke|doraay ki waja|samasya|anya\s+samasya/i.test(t)) return true
  if (/sharamadi|sharamgah|insulin jaisi hormone ki kami/i.test(t)) return true
  if (/samananoj|samanajo|samaanaj|samanan|samanajo/i.test(t)) return true
  if (/shayad rest|sudharay diet|dhoop ya barish/i.test(t) && !/dhoop|barish|sun|rain/i.test(userText))
    return true
  if (looksLikeHindiRomanUrdu(t)) return true
  return false
}

/** Dismissive, Hindi-style, or question-shaped model output for fever cases. */
export function isWeakFeverAnalysisText(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  return (
    /\btumhe\b|\btumhein\b|\btumko\b/i.test(t) ||
    /dekhbhaal|dekh\s*bhaal/i.test(t) ||
    /chhoti si tarah|bahut aam hai|aajkal bahut aam/i.test(t) ||
    /Kya aapko lagta hai/i.test(t) ||
    /sambandh me.*diagnosis|masle ka diagnosis/i.test(t) ||
    /samananoj|samanajo|shayad rest|sudharay diet/i.test(t) ||
    looksLikeHindiRomanUrdu(t)
  )
}

/** Model mixed Urdu script / garbage into patient summary. */
export function isGarbledUrduSummary(text: string, userText: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (isWeakFeverAnalysisText(t)) return true
  if (/samananoj|samanajo|samaanaj|samanan/i.test(t)) return true
  if (looksLikeHindiRomanUrdu(t)) return true
  if (/shayad rest|sudharay diet/i.test(t)) return true
  if (isRomanUrduText(userText) && /[\u0600-\u06FF]{20,}/.test(t)) return true
  return false
}

export function buildAnaphylaxisEnglishExplanation(): string {
  return (
    'Sudden lip or face swelling with itching and difficulty breathing after eating peanuts (or another trigger) ' +
    'can be a severe allergic reaction (anaphylaxis) — this is a medical emergency. ' +
    'Use an epinephrine auto-injector (EpiPen) if you have one, then call Rescue 1122 or Edhi 115 or go to the nearest emergency immediately. ' +
    'Do not wait to see if symptoms improve. This is emergency guidance only, not a diagnosis.'
  )
}

export function buildAnaphylaxisRomanUrduSummary(userText: string): string {
  const allergen = /peanut|nuts?|shellfish|egg/i.test(userText) ? 'mungfali/koi khana' : 'koi trigger'
  return (
    'Aap ke symptoms — hont/chehra sujan, poora jism khujli, saans ki dikkat, aur chakkar — ' +
    'shiddat allergic reaction (anaphylaxis) ho sakte hain. Yeh emergency hai. ' +
    `Yeh ${allergen} ke baad minutes mein shuru hua — foran emergency hospital jayein. ` +
    'Agar EpiPen / adrenaline injection hai to doctor ke bataye tareeqay se use karein. ' +
    'Rescue 1122 ya Edhi 115 par call karein. Symptoms kam hon to bhi hospital zaroor jayein. ' +
    'Yeh sirf emergency rehnumai hai — doctor hi confirm karta hai.'
  )
}

const FEVER_CONTEXT =
  /\b(bukhar|bukhaar|bukhhar|fever|بخار|temperature|thand lag|chills?)\b/i

export function buildFeverEnglishExplanation(userText: string): string {
  const prolonged = /2\s*haft|two\s*week|\d+\s*week|14\s*day|lagataar/i.test(userText)
  const evening = /shaam|evening|raat/i.test(userText)
  const bodyAches = /body ache|jism.*dard|dard aur/i.test(userText)
  const appetite = /appetite|bhook|khana/i.test(userText)

  let text =
    'Persistent fever with weakness needs a proper medical check — especially after many days. ' +
    'In Pakistan, common causes include typhoid, malaria, dengue (seasonal), and viral infections; blood tests help narrow this down. '

  if (prolonged) {
    text += 'Fever lasting about two weeks or more should not be managed at home alone — see a general physician soon for examination and tests (such as CBC, typhoid, and malaria/dengue screening as appropriate). '
  }
  if (evening) text += 'Evening fevers with chills can occur with several infections and should be evaluated. '
  if (bodyAches) text += 'Body aches and fatigue often accompany infective fevers. '
  if (appetite) text += 'Reduced appetite with ongoing fever also supports seeing a doctor promptly. '

  text +=
    'Rest, fluids, and paracetamol may ease symptoms temporarily but do not replace diagnosis. ' +
    'This is guidance only, not a diagnosis.'

  return text
}

/** Pakistani Roman Urdu summary for fever + weakness cases. */
export function buildFeverRomanUrduSummary(userText: string): string | null {
  if (!FEVER_CONTEXT.test(userText)) return null
  if (!isRomanUrduText(userText) && !/\b(mujhe|mera|nahi|ni|hai)\b/i.test(userText)) return null

  const prolonged = /2\s*haft|two\s*week|\d+\s*week|14\s*day|lagataar/i.test(userText)
  const evening = /shaam|evening/i.test(userText)
  const chills = /thand|chill/i.test(userText)
  const bodyAches = /body ache|jism.*dard|dard aur/i.test(userText)
  const appetite = /appetite|bhook/i.test(userText)

  let summary =
    'Aap ne bataya ke bukhar aur kamzori ho rahi hai — yeh infection ki alamat ho sakti hai. Pakistan mein aksar typhoid, malaria, dengue (barsaat mein), ya viral bukhar hota hai; doctor blood tests se wajah pata karta hai. '

  if (prolonged) {
    summary +=
      'Do hafton ya us se zyada bukhar ghar par ignore na karein — jaldi general physician (family doctor) se mil kar CBC, typhoid, aur zarurat par malaria/dengue tests karwaein. '
  }
  if (evening || chills) {
    summary += 'Shaam ko bukhar aur thand lagna kai infections mein hota hai — doctor ko poori history batayein. '
  }
  if (bodyAches) {
    summary += 'Jism mein dard (body aches) sath hon to infection ki possibility aur barh jati hai. '
  }
  if (/paseena nahi|no night sweat|night sweat.*nahi/i.test(userText) && evening) {
    summary += 'Raat ko paseena nahi lekin shaam/din ko bukhar hona bhi doctor ko batayein. '
  }

  summary +=
    'Aram, pani, aur doctor ke mashware par paracetamol se takleef kam ho sakti hai — lekin yeh ilaj ki jagah nahi. ' +
    'Tez bukhar, behoshi, ya saans ki dikkat ho to foran Rescue 1122 / Edhi 115 ya emergency hospital jayein. ' +
    'Yeh sirf rehnumai hai — doctor hi sahi tashkhees karega.'

  return summary
}

const ACROMEGALY_CONTEXT =
  /acromegaly|gigantism|pituitary|haath.*barh|hath.*barh|face.*barh|chehra.*barh|hands?.*(larger|big|barh)|growth hormone|IGF/i

export function buildAcromegalyEnglishExplanation(): string {
  return (
    'Acromegaly is usually caused by excess growth hormone, often from a benign pituitary gland tumour — not low insulin. ' +
    'Gradually enlarging hands or feet, facial changes, and recurring headaches fit this pattern but need blood tests (such as IGF-1) and specialist imaging to confirm. ' +
    'An endocrinologist should assess you. Do not take hormone medicines or supplements without specialist advice. ' +
    'This is guidance only, not a diagnosis.'
  )
}

/** Pakistani Roman Urdu summary when user reports acromegaly-type symptoms. */
export function buildAcromegalyRomanUrduSummary(userText: string): string | null {
  if (!ACROMEGALY_CONTEXT.test(userText)) return null
  if (!isRomanUrduText(userText) && !/\b(mujhe|mera|lagta|hai)\b/i.test(userText)) return null

  const headaches = /headache|sar dard|dard.*haft/i.test(userText)
  const months = /month|mahin|pichl/i.test(userText)

  let summary =
    'Aap ne bataya ke haath aur chehre ka size barh raha hai — yeh acromegaly (growth hormone zyada) jaisi bimari ki alamat ho sakti hai, lekin sirf doctor tests se confirm karta hai. '

  if (months) {
    summary += 'Mahinon se badhti takleef ko nazar andaaz na karein. '
  }
  if (headaches) {
    summary += 'Haftay mein baar baar sar dard bhi is masle se jud sakta hai — endocrinologist (hormone specialist) se jaldi milna chahiye. '
  }

  summary +=
    'Endocrinologist blood tests (jaise IGF-1) aur zarurat par MRI karwa kar wajah batata hai. Khud se hormone ya insulin ki dawai mat lein. ' +
    'Achanak tez sar dard, dekhne mein dikkat, ya behoshi ho to foran Rescue 1122 / Edhi 115 ya emergency hospital jayein. ' +
    'Yeh sirf rehnumai hai — doctor hi sahi tashkhees karega.'

  return summary
}
