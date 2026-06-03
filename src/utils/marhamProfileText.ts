/** Detect Marham auto-generated profile copy (same template on most doctors). */

const BOILERPLATE_PATTERNS = [
  /is a renowned .+ based in /i,
  /There are multiple doctors operating in/i,
  /has managed to gain a well-known reputation/i,
  /has high amount of significance in the medical/i,
  /has had many successful patient feedbacks/i,
  /thorough knowledge in it['']s field/i,
  /is expert in treating /i,
  /Marham provides easy yet efficient appointment/i,
  /you can do it in the blink of an eye/i,
  /Top rated other medical practitioners/i,
]

export function isMarhamBoilerplateStatement(text: string | null | undefined): boolean {
  if (!text?.trim()) return false
  const hits = BOILERPLATE_PATTERNS.filter((p) => p.test(text)).length
  return hits >= 2
}

export function cleanMarhamListItems(items: string[] | undefined): string[] {
  if (!items?.length) return []

  const out: string[] = []
  const seen = new Set<string>()

  for (const raw of items) {
    const parts = raw
      .split(/\\n|\n|\r/)
      .map((p) => p.trim())
      .filter(Boolean)

    for (const part of parts.length > 0 ? parts : [raw.trim()]) {
      const s = part.replace(/\s+/g, ' ').trim()
      if (s.length < 2 || s.length > 80) continue
      if (/[<>]|<!--|-->|^\s*--\s*$/i.test(s)) continue
      if (/^services\s*(-->|<!--)/i.test(s)) continue
      if (/^(services|diseases|symptoms|interest|faqs)$/i.test(s)) continue
      if (isMarhamBoilerplateStatement(s)) continue
      const key = s.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(s)
    }
  }

  return out.slice(0, 25)
}
