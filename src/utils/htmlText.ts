/** Strip HTML to plain text for display and parsing. */

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

import { isMarhamBoilerplateStatement } from './marhamProfileText'

/** Clean scraped professional statement for UI. */
export function sanitizeProfessionalStatement(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  let s = raw.includes('<') ? htmlToPlainText(raw) : raw
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/^Professional Statement by\s*/i, '')
  const cut = s.split(/Following are the services|Diseases treated by|<h3|Services\s+Pulmonary/i)[0]
  s = cut?.trim() ?? s
  if (s.length < 40 || /<[^>]+>/.test(s) || /class=["']/.test(s)) return null
  if (isMarhamBoilerplateStatement(s)) return null
  return s.length > 2000 ? s.slice(0, 2000) : s
}
