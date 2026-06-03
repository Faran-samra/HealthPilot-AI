/**
 * Pakistan health statistics from WHO GHO API with 24h Supabase cache.
 */

import { createClient } from 'npm:@supabase/supabase-js'
import {
  CACHE_TTL_MS,
  fetchIndicatorBundle,
  KPI_INDICATORS,
  WHO_CAUSES_SOURCE_YEAR,
  WHO_LEADING_CAUSES_GHE_2021,
  WHO_PAKISTAN_POPULATION_FALLBACK,
  type GhoLatestValue,
  type IndicatorDef,
} from '../_shared/who-gho.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CACHE_KEY = 'pakistan'

interface KpiItem {
  key: string
  label: string
  unit: string
  year: number
  value: number
  displayValue: string
  low?: number
  high?: number
}

interface CauseItem {
  key: string
  label: string
  year: number
  deathsPer100k: number
  displayValue: string
}

interface WhoPakistanPayload {
  country: {
    name: string
    iso3: string
    whoRegion: string
    incomeLevel: string
    whoDataUrl: string
  }
  fetchedAt: string
  expiresAt: string
  fromCache: boolean
  kpis: KpiItem[]
  leadingCauses: CauseItem[]
  causesSourceYear: number
  attribution: {
    source: string
    license: string
    citation: string
    api: string
  }
}

function formatNumber(n: number, decimals = 1): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000) return Math.round(n).toLocaleString('en-PK')
  return n.toFixed(decimals)
}

/** Remove WHO confidence intervals from display strings. */
function cleanDisplay(raw: string, fallback: number): string {
  const stripped = raw.replace(/\s*\[[^\]]*]/g, '').trim()
  return stripped || String(fallback)
}

function toKpi(def: IndicatorDef, raw: GhoLatestValue | null): KpiItem | null {
  if (!raw) return null
  const value = def.scale ? raw.value * def.scale : raw.value
  const displayValue =
    def.scale && def.key === 'population'
      ? formatNumber(value, 0)
      : def.key === 'health_expenditure_gdp'
        ? value.toFixed(1)
        : cleanDisplay(raw.display, value)

  return {
    key: def.key,
    label: def.label,
    unit: def.unit,
    year: raw.year,
    value,
    displayValue,
    low: raw.low != null && def.scale ? raw.low * def.scale : raw.low,
    high: raw.high != null && def.scale ? raw.high * def.scale : raw.high,
  }
}

async function buildPayload(): Promise<WhoPakistanPayload> {
  const kpiMap = await fetchIndicatorBundle(KPI_INDICATORS)

  const baseKpis = KPI_INDICATORS.map((d) => toKpi(d, kpiMap.get(d.key) ?? null)).filter(
    (k): k is KpiItem => k != null,
  )

  const kpis = !baseKpis.some((k) => k.key === 'population')
    ? [
        ...baseKpis,
        {
          key: WHO_PAKISTAN_POPULATION_FALLBACK.key,
          label: WHO_PAKISTAN_POPULATION_FALLBACK.label,
          unit: WHO_PAKISTAN_POPULATION_FALLBACK.unit,
          year: WHO_PAKISTAN_POPULATION_FALLBACK.year,
          value: WHO_PAKISTAN_POPULATION_FALLBACK.value,
          displayValue: WHO_PAKISTAN_POPULATION_FALLBACK.displayValue,
        },
      ]
    : baseKpis

  const leadingCauses: CauseItem[] = WHO_LEADING_CAUSES_GHE_2021.map((c) => ({
    key: c.key,
    label: c.label,
    year: c.year,
    deathsPer100k: c.deathsPer100k,
    displayValue: String(c.deathsPer100k),
  }))

  const now = new Date()
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS)

  return {
    country: {
      name: 'Pakistan',
      iso3: 'PAK',
      whoRegion: 'Eastern Mediterranean',
      incomeLevel: 'Lower-middle income',
      whoDataUrl: 'https://data.who.int/countries/586',
    },
    fetchedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    fromCache: false,
    kpis,
    leadingCauses,
    causesSourceYear: WHO_CAUSES_SOURCE_YEAR,
    attribution: {
      source: 'World Health Organization (WHO)',
      license: 'CC BY-NC-SA 3.0 IGO',
      citation:
        'World Health Organization, Global Health Observatory (GHO) via ghoapi.azureedge.net — Pakistan (PAK).',
      api: 'https://ghoapi.azureedge.net/api/',
    },
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration missing' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const forceRefresh =
    req.method === 'POST' &&
    (await req.json().catch(() => ({})))?.refresh === true

  const supabase = createClient(url, serviceKey)

  if (!forceRefresh) {
    const { data: cached, error: cacheErr } = await supabase
      .from('who_pakistan_stats_cache')
      .select('payload, fetched_at, expires_at')
      .eq('cache_key', CACHE_KEY)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (!cacheErr && cached?.payload) {
      const payload = cached.payload as WhoPakistanPayload
      return new Response(
        JSON.stringify({
          ...payload,
          fromCache: true,
          fetchedAt: cached.fetched_at,
          expiresAt: cached.expires_at,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
  }

  try {
    const payload = await buildPayload()

    const { error: upsertErr } = await supabase.from('who_pakistan_stats_cache').upsert({
      cache_key: CACHE_KEY,
      payload,
      fetched_at: payload.fetchedAt,
      expires_at: payload.expiresAt,
    })

    if (upsertErr) {
      console.warn('Cache upsert failed:', upsertErr.message)
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('who-pakistan-stats failed:', e)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch WHO statistics', detail: String(e) }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
