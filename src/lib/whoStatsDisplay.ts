import type { WhoPakistanCause, WhoPakistanKpi } from '@/types/whoStats'

/** Official WHO country profile for Pakistan (PAK / ISO 586). */
export const WHO_PAKISTAN_PROFILE_URL = 'https://data.who.int/countries/586'

/** WHO GHE 2021 top causes — used if edge cache is stale (data.who.int). */
export const WHO_LEADING_CAUSES_GHE_2021: WhoPakistanCause[] = [
  { key: 'ischaemic_heart', label: 'Ischaemic heart disease', year: 2021, deathsPer100k: 90.2, displayValue: '90.2' },
  { key: 'covid_19', label: 'COVID-19', year: 2021, deathsPer100k: 54.4, displayValue: '54.4' },
  { key: 'stroke', label: 'Stroke', year: 2021, deathsPer100k: 47.7, displayValue: '47.7' },
  { key: 'prematurity', label: 'Preterm birth complications', year: 2021, deathsPer100k: 40.1, displayValue: '40.1' },
  { key: 'birth_asphyxia', label: 'Birth asphyxia and birth trauma', year: 2021, deathsPer100k: 36.4, displayValue: '36.4' },
  { key: 'copd', label: 'Chronic obstructive pulmonary disease', year: 2021, deathsPer100k: 28.9, displayValue: '28.9' },
  { key: 'lower_respiratory', label: 'Lower respiratory infections', year: 2021, deathsPer100k: 27.2, displayValue: '27.2' },
  { key: 'diabetes', label: 'Diabetes mellitus', year: 2021, deathsPer100k: 23.0, displayValue: '23' },
  { key: 'tuberculosis', label: 'Tuberculosis', year: 2021, deathsPer100k: 22.2, displayValue: '22.2' },
]

export const WHO_PAKISTAN_POPULATION_FALLBACK = {
  key: 'population',
  label: 'Population',
  unit: 'people',
  year: 2023,
  value: 247_504_495,
  displayValue: '247.5 million',
}

/** Strip WHO confidence ranges like "66 [65 - 67]" → "66" */
export function simplifyWhoNumber(display: string, fallback: number): string {
  const cleaned = display.replace(/\s*\[[^\]]*]/g, '').trim()
  const num = parseFloat(cleaned.replace(/,/g, ''))
  if (!Number.isNaN(num)) {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)} million`
    if (num >= 100_000) return `${Math.round(num / 1000)}k`
    if (Number.isInteger(num)) return String(Math.round(num))
    return num.toFixed(1)
  }
  return String(Math.round(fallback))
}

export function formatPopulation(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} million`
  return value.toLocaleString('en-PK')
}

export function causeSharePercent(causes: WhoPakistanCause[]): Map<string, number> {
  const total = causes.reduce((s, c) => s + c.deathsPer100k, 0) || 1
  return new Map(causes.map((c) => [c.key, Math.round((c.deathsPer100k / total) * 100)]))
}

export const GLANCE_KPI_KEYS = [
  'population',
  'maternal_mortality',
  'under_five_mortality',
  'health_expenditure_gdp',
] as const

export const HEALTH_FOCUS_KEYS = [
  'tb_incidence',
  'malaria_incidence',
  'ncd_premature_risk',
  'health_expenditure_gdp',
] as const

export function pickKpis(kpis: WhoPakistanKpi[], keys: readonly string[]): WhoPakistanKpi[] {
  return keys
    .map((key) => kpis.find((k) => k.key === key))
    .filter((k): k is WhoPakistanKpi => k != null)
}

/** Colors for donut segments (top causes) */
export const CAUSE_CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(199 89% 48%)',
  'hsl(152 69% 40%)',
  'hsl(38 92% 50%)',
  'hsl(280 67% 55%)',
  'hsl(0 72% 51%)',
  'hsl(174 58% 39%)',
  'hsl(220 14% 46%)',
]
