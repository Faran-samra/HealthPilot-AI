import type { WhoPakistanCause, WhoPakistanKpi } from '@/types/whoStats'

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
  'life_expectancy',
  'population',
  'maternal_mortality',
  'under_five_mortality',
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
