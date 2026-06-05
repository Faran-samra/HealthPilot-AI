const UK_TO_PK_REPLACEMENTS: [RegExp, string][] = [
  [/\bNHS\s*111\b/gi, 'Rescue 1122 or Edhi 115'],
  [/\b111\b(?=\s*(service|NHS))/gi, '1122'],
  [/\bcall\s*999\b/gi, 'call Rescue 1122 or go to the nearest hospital emergency'],
  [/\b999\b/g, '1122 (emergency)'],
  [/\bA&E\b/g, 'hospital emergency department'],
  [/\bA\s*&\s*E\b/g, 'hospital emergency department'],
  [/\byour\s+GP\b/gi, 'a general physician'],
  [/\bsee\s+a\s+GP\b/gi, 'see a general physician at a hospital OPD or clinic'],
  [/\bGP\b/g, 'general physician'],
  [/\bNHS\b/g, 'local healthcare services'],
  [/\bprimary care\b/gi, 'outpatient clinic'],
  [/\babdominal aortic aneurysm screening\b/gi, 'vascular screening (where available locally)'],
]

export function localizeUkText(text: string): string {
  let out = text
  for (const [pattern, replacement] of UK_TO_PK_REPLACEMENTS) {
    out = out.replace(pattern, replacement)
  }
  return out.trim()
}
