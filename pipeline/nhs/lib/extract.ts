import { load } from 'cheerio'
import type { NhsSections, NhsStructuredCondition } from './types.ts'
import { slugFromUrl } from './sitemap.ts'
import { normalizeSectionText, stripRedundantHeading } from './text-cleanup.ts'

const SKIP_HEADING =
  /^(page last reviewed|next review due|media last reviewed|video:|information:|what is |transcript|audio description|bsl|play video)/i

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()
}

type SectionKey =
  | keyof NhsSections
  | 'when_to_seek_help'
  | 'urgent_care'
  | 'emergency_care'
  | 'other'
  | null

function mapHeadingToSection(heading: string): SectionKey {
  const h = heading.toLowerCase()
  if (SKIP_HEADING.test(h)) return null

  if (
    h.includes('ease') ||
    h.includes('relieve') ||
    h.includes('self-care') ||
    h.includes('things you can do') ||
    h.includes('help with') ||
    (h.includes('how to') && (h.includes('ease') || h.includes('help') || h.includes('manage')))
  ) {
    return 'self_care'
  }
  if (/^symptoms of\b/i.test(heading) || (h.includes('symptom') && !h.includes('ease') && !h.includes('relieve'))) {
    return 'symptoms'
  }
  if (h.includes('cause')) return 'causes'
  if (/^treating\b/i.test(heading) || h.includes('treatment') || h.includes('treat ')) return 'treatment'
  if (h.includes('diagnos') || h.includes('test') || /what happens at your appointment/i.test(h)) {
    return 'diagnosis'
  }
  if (
    h.includes('prevent') ||
    h.includes('vaccin') ||
    h.includes('lower your risk') ||
    h.includes('reduce your risk') ||
    h.includes('contagious') ||
    h.includes('how long') && h.includes('spread')
  ) {
    return 'prevention'
  }
  if (
    h.includes('dangerous') ||
    h.includes('complication') ||
    h.includes('can cause') ||
    h.includes('problems such as') ||
    (h.includes('risk') && !h.includes('reduce'))
  ) {
    return 'complications'
  }
  if (
    h.includes('immediate action') ||
    h.includes('call 999') ||
    h.includes('go to a&e') ||
    h.includes('go to ae')
  ) {
    return 'emergency_care'
  }
  if (
    h.includes('urgent advice') ||
    h.includes('ask for an urgent') ||
    h.includes('see a gp') ||
    h.includes('nhs 111') ||
    h.includes('when to get') ||
    h.includes('when to see') ||
    h.includes('when to go')
  ) {
    return 'urgent_care'
  }
  if (h.includes('overview') || h.includes('about ') || h === 'what is whooping cough') {
    return 'overview'
  }
  return 'other'
}

function collectListItems($: ReturnType<typeof load>, listEl: ReturnType<typeof load>): string[] {
  const items: string[] = []
  listEl.find('> li').each((_, li) => {
    const t = cleanText($(li).text())
    if (t) items.push(`- ${t}`)
  })
  return items
}

function collectBlockText($: ReturnType<typeof load>, startEl: Parameters<ReturnType<typeof load>>[0]): string {
  const parts: string[] = []
  let next = $(startEl).next()
  while (next.length) {
    const tag = next.prop('tagName')?.toString().toLowerCase()
    if (tag === 'h2' || tag === 'h1') break
    if (tag === 'h3') {
      const h3 = cleanText(next.text())
      const h3body = collectBlockText($, next[0])
      if (h3body) parts.push(`${h3}\n${h3body}`)
      next = next.next()
      continue
    }
    if (tag === 'ul' || tag === 'ol') {
      const items = collectListItems($, next)
      if (items.length) parts.push(items.join('\n'))
      next = next.next()
      continue
    }
    const text = cleanText(next.text())
    if (text) parts.push(text)
    next = next.next()
  }
  return normalizeSectionText(parts.join('\n\n'))
}

function appendSection(sections: NhsSections, key: keyof NhsSections, block: string): void {
  if (!block.trim()) return
  const prev = sections[key]
  sections[key] = prev ? `${prev}\n\n${block}` : block
}

export function extractConditionFromHtml(url: string, html: string): NhsStructuredCondition {
  const $ = load(html)
  const slug = slugFromUrl(url)

  $('script, style, nav, header, footer, .nhsuk-global-alert, .nhsuk-back-link, [aria-hidden="true"]').remove()

  const main = $('main').length ? $('main') : $('article').length ? $('article') : $('body')
  const condition_name = cleanText(main.find('h1').first().text()) || slug.replace(/-/g, ' ')

  const sections: NhsSections = {}
  const overviewParts: string[] = []

  const h1 = main.find('h1').first()
  if (h1.length) {
    const intro = collectBlockText($, h1[0])
    if (intro) overviewParts.push(intro)
  }

  main.find('h2').each((_, el) => {
    const heading = cleanText($(el).text())
    const key = mapHeadingToSection(heading)
    if (!key) return
    let body = collectBlockText($, el)
    if (!body) return
    body = stripRedundantHeading(body, heading)
    const block = normalizeSectionText(`${heading}\n\n${body}`)

    if (key === 'urgent_care' || key === 'emergency_care') {
      appendSection(sections, key, block)
    } else if (key === 'other') {
      appendSection(sections, 'other', block)
    } else {
      appendSection(sections, key as keyof NhsSections, block)
    }
  })

  if (overviewParts.length && !sections.overview) {
    sections.overview = normalizeSectionText(overviewParts.join('\n\n'))
  }

  for (const key of Object.keys(sections) as (keyof NhsSections)[]) {
    const val = sections[key]
    if (val) sections[key] = normalizeSectionText(val)
  }

  const when_to_seek_help_uk = [sections.urgent_care, sections.emergency_care, sections.when_to_seek_help]
    .filter(Boolean)
    .join('\n\n')

  if (when_to_seek_help_uk) {
    sections.when_to_seek_help = when_to_seek_help_uk
  }

  return {
    slug,
    condition_name,
    source_url: url.replace(/\/?$/, '/'),
    source: 'nhs_uk',
    licence: 'OGL-3.0',
    category: 'A-Z conditions',
    scraped_at: new Date().toISOString(),
    sections,
    when_to_seek_help_uk: when_to_seek_help_uk || undefined,
  }
}

export async function fetchAndExtract(url: string): Promise<NhsStructuredCondition> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'HealthPilotAI/1.0 (research; contact: healthpilot@example.com)',
      Accept: 'text/html',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const html = await res.text()
  return extractConditionFromHtml(url, html)
}
