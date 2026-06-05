/**
 * Client-side Roman Urdu helpers (keep aligned with supabase/functions/_shared/roman-urdu.ts).
 */

export type UrduVariant = 'roman' | 'script' | 'mixed'
export type ChatLanguage = 'en' | 'ur'

const URDU_SCRIPT = /[\u0600-\u06FF]/

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

export function isEnglishUserText(text: string): boolean {
  const t = text.trim()
  if (!t || hasUrduScript(t)) return false
  if (!/[a-z]/i.test(t)) return false
  if (isRomanUrduText(t)) return false
  return /\b(I|my|me|have|had|been|for|the|last|days|weeks|fever|cough|sneez|pain|eyes|nose|blocked|watery|outdoor|dusty|windy|worse|mild|severe|symptoms|especially|getting)\b/i.test(
    t
  )
}

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

/** Text direction for chat bubbles: Roman Urdu is LTR; Urdu script is RTL. */
export function messageTextDirection(content: string, language: ChatLanguage): 'ltr' | 'rtl' {
  if (language !== 'ur') return 'ltr'
  return hasUrduScript(content) ? 'rtl' : 'ltr'
}
