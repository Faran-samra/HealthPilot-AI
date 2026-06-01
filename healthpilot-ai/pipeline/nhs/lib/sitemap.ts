const SITEMAP_INDEX = 'https://www.nhs.uk/sitemap.xml'
const CMS_SITEMAP = 'https://www.nhs.uk/sitemap-cms-content.xml'
const CONDITION_PATH = '/conditions/'

const FETCH_HEADERS = {
  'User-Agent': 'HealthPilotAI/1.0 (research; contact: healthpilot@example.com)',
  Accept: 'application/xml,text/xml',
}

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim())
}

function isConditionUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (!u.hostname.endsWith('nhs.uk')) return false
    if (!u.pathname.startsWith(CONDITION_PATH)) return false
    const rest = u.pathname.slice(CONDITION_PATH.length).replace(/\/$/, '')
    if (!rest || rest.includes('/')) return false
    if (rest.endsWith('.aspx')) return false
    return true
  } catch {
    return false
  }
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, { headers: FETCH_HEADERS })
  if (!res.ok) throw new Error(`Sitemap fetch failed ${url}: ${res.status}`)
  return res.text()
}

/** Extract condition page URLs from NHS sitemap index + CMS content sitemap. */
export async function fetchConditionUrls(): Promise<string[]> {
  const indexXml = await fetchXml(SITEMAP_INDEX)
  const childSitemaps = extractLocs(indexXml)

  const cmsUrl = childSitemaps.find((u) => u.includes('sitemap-cms-content')) ?? CMS_SITEMAP
  const cmsXml = await fetchXml(cmsUrl)
  const allLocs = extractLocs(cmsXml)

  const urls = allLocs.filter(isConditionUrl)
  return [...new Set(urls)].sort()
}

export function slugFromUrl(url: string): string {
  const u = new URL(url)
  return u.pathname.replace(CONDITION_PATH, '').replace(/\/$/, '')
}
