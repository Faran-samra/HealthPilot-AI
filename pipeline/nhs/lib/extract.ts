import { load } from 'cheerio'
import type { NhsSections, NhsStructuredCondition } from './types.ts'
import { slugFromUrl } from './sitemap.ts'

const SKIP_HEADING = /^(page last reviewed|next review due|media last reviewed|video:|information:)/i

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()
}

function mapHeadingToSection(heading: string): keyof NhsSections | 'when_to_seek_help' | null {
  const h = heading.toLowerCase()
  if (SKIP_HEADING.test(h)) return null
  if (h.includes('symptom')) return 'symptoms'
  if (h.includes('cause')) return 'causes'
  if (h.includes('diagnos') || h.includes('test')) return 'diagnosis'
  if (h.includes('treatment') || h.includes('treat ')) return 'treatment'
  if (h.includes('prevent') || h.includes('lower your risk') || h.includes('reduce your risk')) {
    return 'prevention'
  }
  if (
    h.includes('see a gp') ||
    h.includes('call 999') ||
    h.includes('urgent advice') ||
    h.includes('immediate action') ||
    h.includes('when to get') ||
    h.includes('when to see') ||
    h.includes('when to go')
  ) {
    return 'when_to_seek_help'
  }
  if (h.includes('overview') || h.includes('about ')) return 'overview'
  return 'other'
}

function collectSectionText($: ReturnType<typeof load>, startEl: Parameters<ReturnType<typeof load>>[0]): string {
  const parts: string[] = []
  let next = $(startEl).next()
  while (next.length) {
    const tag = next.prop('tagName')?.toString().toLowerCase()
    if (tag === 'h2' || tag === 'h1') break
    const text = cleanText(next.text())
    if (text) parts.push(text)
    next = next.next()
  }
  return cleanText(parts.join('\n\n'))
}

export function extractConditionFromHtml(url: string, html: string): NhsStructuredCondition {
  const $ = load(html)
  const slug = slugFromUrl(url)

  $('script, style, nav, header, footer, .nhsuk-global-alert, .nhsuk-back-link').remove()

  const main = $('main').length ? $('main') : $('article').length ? $('article') : $('body')
  const condition_name = cleanText(main.find('h1').first().text()) || slug.replace(/-/g, ' ')

  const sections: NhsSections = {}
  const overviewParts: string[] = []

  const h1 = main.find('h1').first()
  if (h1.length) {
    const intro = collectSectionText($, h1[0])
    if (intro) overviewParts.push(intro)
  }

  main.find('h2').each((_, el) => {
    const heading = cleanText($(el).text())
    const key = mapHeadingToSection(heading)
    if (!key) return
    const body = collectSectionText($, el)
    if (!body) return
    const block = `${heading}\n\n${body}`
    if (key === 'when_to_seek_help') {
      sections.when_to_seek_help = sections.when_to_seek_help
        ? `${sections.when_to_seek_help}\n\n${block}`
        : block
    } else if (key === 'other') {
      sections.other = sections.other ? `${sections.other}\n\n${block}` : block
    } else {
      const k = key as keyof NhsSections
      sections[k] = sections[k] ? `${sections[k]}\n\n${block}` : block
    }
  })

  if (overviewParts.length && !sections.overview) {
    sections.overview = overviewParts.join('\n\n')
  }

  const when_to_seek_help_uk = sections.when_to_seek_help

  return {
    slug,
    condition_name,
    source_url: url.replace(/\/?$/, '/'),
    source: 'nhs_uk',
    licence: 'OGL-3.0',
    category: 'A-Z conditions',
    scraped_at: new Date().toISOString(),
    sections,
    when_to_seek_help_uk,
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

