import { htmlToPlainText } from '../../../src/utils/htmlText.ts'
import {
  cleanMarhamListItems,
  isMarhamBoilerplateStatement,
} from '../../../src/utils/marhamProfileText.ts'

/** Strip non-content blocks before regex parsing public profile HTML. */

export function stripNonContentHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
}

export function extractJsonField(html: string, field: string): string | null {
  const re = new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`, 'i')
  const m = html.match(re)
  return m?.[1]?.trim() || null
}

export function extractMetaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i',
  )
  const m = html.match(re)
  return m?.[1]?.trim() || null
}

export function extractFirstH1(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (!m) return null
  return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null
}

/** Marham og:title — "Dr. Name - Specialty at Hospital Name" */
export function parseMarhamProfileTitle(title: string | null | undefined): {
  name?: string
  specialty?: string
  hospital?: string
} {
  if (!title) return {}
  const decoded = title.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
  const m = decoded.match(/^(.+?)\s-\s(.+?)\s+at\s+(.+)$/i)
  if (!m) return {}
  return { name: m[1].trim(), specialty: m[2].trim(), hospital: m[3].trim() }
}

export function extractFeePkr(html: string): number | null {
  const m = html.match(/(?:PKR|Rs\.?)\s*([\d,]+)/i)
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : null
}

/** Consultation fee from practice block (not sidebar "Starting from Rs. 500"). */
export function extractMarhamConsultationFee(html: string): number | null {
  const practiceBlock = html.match(
    /Practice Address[\s\S]{0,1200}?(?=Available Timings|No extra charges|Report In-correct)/i,
  )?.[0]

  if (practiceBlock) {
    const amounts: number[] = []
    for (const m of practiceBlock.matchAll(/(?:PKR|Rs\.?)\s*([\d,]+)/gi)) {
      const n = parseInt(m[1].replace(/,/g, ''), 10)
      if (n >= 200 && n <= 100_000) amounts.push(n)
    }
    if (amounts.length > 0) return amounts[amounts.length - 1]
  }

  const jsonFee =
    extractJsonField(html, 'consultation_fee') ??
    extractJsonField(html, 'fee') ??
    extractJsonField(html, 'price')
  if (jsonFee) {
    const n = parseInt(jsonFee.replace(/[^\d]/g, ''), 10)
    if (n >= 200 && n <= 100_000) return n
  }

  for (const m of html.matchAll(/(?:PKR|Rs\.?)\s*([\d,]+)/gi)) {
    const idx = m.index ?? 0
    const before = html.slice(Math.max(0, idx - 80), idx).toLowerCase()
    if (/starting from|ghar bethe|save time and money|online psychiatric/i.test(before)) {
      continue
    }
    const n = parseInt(m[1].replace(/,/g, ''), 10)
    if (n >= 200 && n <= 100_000) return n
  }

  return null
}

/** Marham "Practice Address and Timings" block. */
export function extractMarhamPractice(html: string): {
  hospital_name?: string
  area?: string
  address?: string
  qualification?: string
} {
  const content = stripNonContentHtml(html)
  const out: {
    hospital_name?: string
    area?: string
    address?: string
    qualification?: string
  } = {}

  const practiceBlock = content.match(/Practice Address[\s\S]{0,700}?Area:/i)?.[0]
  if (practiceBlock) {
    const beforeArea = practiceBlock
      .replace(/Practice Address[^A-Za-z]*/i, '')
      .replace(/Area:\s*.*$/i, '')
      .replace(/<[^>]+>/g, '\n')
    const lines = beforeArea
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 3 && !/available timings|mon|tue|wed/i.test(l))
    const hospitalLine = lines.find((l) =>
      /hospital|clinic|complex|centre|center|medical/i.test(l),
    )
    if (hospitalLine) {
      out.hospital_name = hospitalLine.replace(/\s+/g, ' ').trim()
    }
  }

  if (!out.hospital_name) {
    const hospitalFromPractice = content.match(
      /([A-Z][A-Za-z0-9\s&.'()-]{4,90}(?:Hospital|Clinic|Complex|Centre|Center|Medical(?:\s+Complex)?))/,
    )?.[1]
    if (hospitalFromPractice && !/practice address/i.test(hospitalFromPractice)) {
      out.hospital_name = hospitalFromPractice.replace(/\s+/g, ' ').trim()
    }
  }

  const areaLine =
    content.match(/Area:\s*([^<\n]+)/i)?.[1]?.trim() ??
    extractJsonField(html, 'area') ??
    extractJsonField(html, 'locality')

  if (areaLine) {
    out.address = areaLine.replace(/\s+/g, ' ').trim()
    const parts = areaLine.split(',').map((p) => p.trim()).filter(Boolean)
    out.area = parts[0] ?? areaLine
  }

  if (!out.hospital_name) {
    out.hospital_name =
      extractJsonField(html, 'hospital_name') ??
      extractJsonField(html, 'practice_name') ??
      undefined
  }

  const qualMatch = content.match(
    /\|\s*((?:MBBS|BDS|FCPS|FRCS|MCPS|MRCP|MD|MS|DTCD|DLO|DPM|DCH|DTM)[^|\n<]*(?:\s*\|\s*[^|\n<]+)*)/i,
  )
  if (qualMatch) {
    out.qualification = qualMatch[1].replace(/\s+/g, ' ').trim()
  }

  return out
}

function extractListItems(sectionHtml: string): string[] {
  return [...sectionHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => htmlToPlainText(m[1]))
    .filter((l) => l.length > 2 && l.length < 80 && !/[<>]|class=/i.test(l))
}

function splitPlainList(sectionHtml: string): string[] {
  const plain = htmlToPlainText(sectionHtml)
  const afterColon = plain.split(/:\s*/).pop() ?? plain
  return afterColon
    .split(/,|\s{2,}/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && l.length < 60 && !/^(by|services|diseases)$/i.test(l))
}

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

function normalizeDayLabel(day: string): string {
  const d = day.trim().slice(0, 3).toLowerCase()
  const map: Record<string, string> = {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
  }
  return map[d] ?? day
}

function extractPracticeTimingsFromHtml(html: string): { day: string; start: string; end: string }[] {
  const byDay = new Map<string, { day: string; start: string; end: string }>()

  const add = (dayRaw: string, start: string, end: string) => {
    const day = normalizeDayLabel(dayRaw)
    if (!DAY_ORDER.includes(day as (typeof DAY_ORDER)[number])) return
    byDay.set(day, { day, start: amPmTo24h(start), end: amPmTo24h(end) })
  }

  const blocks = [
    html.match(
      /Available Timings[\s\S]{0,12000}?(?=No extra charges|Report In-correct|Off Panel|Update Information|Ghar bethe)/i,
    )?.[0],
    html.match(
      /Practice Address[\s\S]{0,15000}?(?=Report In-correct|Update Information as Doctor|Off Panel Doctor)/i,
    )?.[0],
  ].filter(Boolean) as string[]

  const rangeRe = /(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–—]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i

  for (const block of blocks) {
    const trRe = /<tr[^>]*>[\s\S]*?<\/tr>/gi
    let tr: RegExpExecArray | null
    while ((tr = trRe.exec(block)) !== null) {
      const row = tr[0]
      const dayM = row.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i)
      const timeM = row.match(rangeRe)
      if (dayM && timeM) add(dayM[1], timeM[1], timeM[2])
    }

    const dayTimeRe =
      /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b[\s\S]{0,250}?(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–—]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/gi
    let m: RegExpExecArray | null
    while ((m = dayTimeRe.exec(block)) !== null) {
      add(m[1], m[2], m[3])
    }

    const plain = htmlToPlainText(block)
    const plainRe =
      /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b\s+(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–—]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/gi
    while ((m = plainRe.exec(plain)) !== null) {
      add(m[1], m[2], m[3])
    }
  }

  return DAY_ORDER.filter((d) => byDay.has(d)).map((d) => byDay.get(d)!)
}

export { extractPracticeTimingsFromHtml }

function extractMarhamSectionList(html: string, section: 'Services' | 'Diseases'): string[] {
  const sectionHtml = html.match(
    new RegExp(
      `(?:<h[23][^>]*>\\s*${section}\\s*<|\\b${section}\\b)[\\s\\S]{0,5000}?(?=Diseases|Symptoms|Interest|Professional Statement|FAQs|Appointment Details|Marham provides|Following are the services)`,
      'i',
    ),
  )?.[0]
  if (!sectionHtml) return []

  const fromLi = extractListItems(sectionHtml)
  const cleaned = cleanMarhamListItems(fromLi.length > 0 ? fromLi : splitPlainList(sectionHtml))
  return cleaned.filter((s) => !/^(dizziness|fever|cough)$/i.test(s) || section === 'Services')
}

function amPmTo24h(time: string): string {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return time.trim()
  let h = parseInt(m[1], 10)
  const min = m[2]
  const pm = m[3].toUpperCase() === 'PM'
  if (pm && h < 12) h += 12
  if (!pm && h === 12) h = 0
  return `${h.toString().padStart(2, '0')}:${min}`
}

export function extractMarhamWhatsApp(html: string): string | null {
  const wa =
    html.match(/wa\.me\/(\d{10,15})/i)?.[1] ??
    html.match(/api\.whatsapp\.com\/send\?phone=(\d{10,15})/i)?.[1] ??
    html.match(/phone=(\d{10,15})/i)?.[1]
  return wa ?? null
}

export function extractMarhamProfileDetails(
  html: string,
  doctorName: string,
): {
  professional_statement?: string
  services?: string[]
  diseases?: string[]
  practice_timings?: { day: string; start: string; end: string }[]
  marham_whatsapp?: string
} {
  const content = stripNonContentHtml(html)
  const out: {
    professional_statement?: string
    services?: string[]
    diseases?: string[]
    practice_timings?: { day: string; start: string; end: string }[]
    marham_whatsapp?: string
  } = {}

  const stmtHtml = html.match(
    /Professional Statement by[\s\S]*?(?=Following are the services|Diseases treated by|Services\s*<|FAQs|Report In-correct)/i,
  )?.[0]
  if (stmtHtml) {
    let stmt = htmlToPlainText(stmtHtml)
    stmt = stmt.replace(/^Professional Statement by\s*/i, '')
    const nameEsc = doctorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    stmt = stmt.replace(new RegExp(`^${nameEsc}\\s*`, 'i'), '')
    stmt = stmt.split(/Following are the services/i)[0]?.trim() ?? stmt
    if (
      stmt.length > 80 &&
      !/class=|font-weight|<\//i.test(stmt) &&
      !isMarhamBoilerplateStatement(stmt)
    ) {
      out.professional_statement = stmt.slice(0, 2000)
    }
  }

  out.services = extractMarhamSectionList(html, 'Services')

  const diseasesFromSection = extractMarhamSectionList(html, 'Diseases')
  if (diseasesFromSection.length > 0) {
    out.diseases = diseasesFromSection
  } else {
    const diseasesHtml = html.match(
      /(?:Diseases treated by|common diseases treated by)[\s\S]*?(?=Appointment Details|Marham provides|FAQs|Professional Statement)/i,
    )?.[0]
    if (diseasesHtml) {
      const fromLi = extractListItems(diseasesHtml)
      out.diseases = cleanMarhamListItems(fromLi.length > 0 ? fromLi : splitPlainList(diseasesHtml))
    }
  }

  out.practice_timings = extractPracticeTimingsFromHtml(html)

  const wa = extractMarhamWhatsApp(html)
  if (wa) out.marham_whatsapp = wa

  return out
}
