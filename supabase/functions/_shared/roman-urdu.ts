/**
 * Roman Urdu vs Urdu script detection for symptom chat (Pakistan).
 */

export type UrduVariant = 'roman' | 'script' | 'mixed'
export type ChatLanguage = 'en' | 'ur'

const URDU_SCRIPT = /[\u0600-\u06FF]/

/** Common Roman Urdu words (Latin letters). */
const ROMAN_URDU_WORD =
  /\b(mujhe|mujhay|muje|mujhay|mere|mera|meri|meray|aap|apko|apkay|ap|ko|se|hai|hain|ho|hon|hun|hoon|nahin|nahi|nhi|bukhar|bukhaar|bukhhar|khansi|khasi|pet|dard|sar|jism|kamzori|kamzor|thak|thakan|bohat|bht|zyada|din|dinon|subah|raat|neend|ulti|qay|khoon|bimar|tab|dawai|shifa|doctor|hospital|lag|raha|feel)\b/i

const ROMAN_URDU_PHRASE =
  /lag raha|ho raha|kar raha|feel ho|ho gya|ho gaya|ho gai|se hai|se hain|din se|kitne din/i

export function hasUrduScript(text: string): boolean {
  return URDU_SCRIPT.test(text)
}

export function isRomanUrduText(text: string): boolean {
  const t = text.trim()
  if (!t || hasUrduScript(t)) return false
  if (!/[a-z]/i.test(t)) return false
  return ROMAN_URDU_WORD.test(t) || ROMAN_URDU_PHRASE.test(t)
}

export function isUrduUserText(text: string): boolean {
  return hasUrduScript(text) || isRomanUrduText(text)
}

/** Prefer the user's latest Urdu writing style. */
export function detectUrduVariant(userLines: string[]): UrduVariant {
  let sawRoman = false
  let sawScript = false
  for (let i = userLines.length - 1; i >= 0; i--) {
    const line = userLines[i]?.trim() ?? ''
    if (!line) continue
    if (hasUrduScript(line)) sawScript = true
    else if (isRomanUrduText(line)) sawRoman = true
    if (sawScript && sawRoman) return 'mixed'
    if (sawScript) return 'script'
    if (sawRoman) return 'roman'
  }
  return 'roman'
}

/** English symptom narrative (not Roman Urdu). */
export function isEnglishUserText(text: string): boolean {
  const t = text.trim()
  if (!t || hasUrduScript(t)) return false
  if (!/[a-z]/i.test(t)) return false
  if (isRomanUrduText(t)) return false
  return /\b(I|my|me|have|had|been|for|the|last|days|weeks|fever|cough|sneez|pain|eyes|nose|blocked|watery|outdoor|dusty|windy|worse|mild|severe|symptoms|especially|getting)\b/i.test(
    t
  )
}

/** Infer chat language from latest user messages; Roman Urdu counts as Urdu. */
export function detectConversationLanguage(
  userLines: string[],
  clientLanguage: ChatLanguage
): ChatLanguage {
  for (let i = userLines.length - 1; i >= 0; i--) {
    const line = userLines[i]?.trim() ?? ''
    if (!line) continue
    if (isUrduUserText(line)) return 'ur'
    if (isEnglishUserText(line)) return 'en'
  }
  return clientLanguage
}

export function urduVariantHint(variant: UrduVariant): string {
  switch (variant) {
    case 'roman':
      return (
        'User writes in Roman Urdu (Latin letters, e.g. "Mujhe bukhar hai"). ' +
        'Write in clear Pakistani Roman Urdu only — NOT Hindi (avoid: samasya, lagbhag, jhankna, shikar, khayen). ' +
        'Use Pakistani words: masla, takreeban, mashwara, foran, dora/doray, neurologist, hospital. ' +
        'Do NOT reply in Urdu script unless the user switches to Urdu script. ' +
        'For final analysis, urdu_summary must be 3-5 short Pakistani Roman Urdu sentences.'
      )
    case 'script':
      return (
        'User writes in Urdu script (Nastaliq). ' +
        'Write the follow-up and urdu_summary in proper Urdu script with respectful Pakistani wording.'
      )
    default:
      return (
        'User mixes Roman Urdu and Urdu script — match their latest user message: ' +
        'Roman Urdu if their last message uses Latin letters; Urdu script if their last message uses Arabic script.'
      )
  }
}
