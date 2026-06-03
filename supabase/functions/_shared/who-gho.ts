/** WHO Global Health Observatory OData API helpers (Pakistan / PAK). */

export const GHO_API_BASE = 'https://ghoapi.azureedge.net/api'
export const PAKISTAN_CODE = 'PAK'
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** National total row for disaggregated indicators (matches data.who.int). */
const NATIONAL_WEALTH_TOTAL = 'WEALTHQUINTILE_TOTL'
const CHILD_AGE_UNDER5 = 'AGEGROUP_YEARSUNDER5'

export interface GhoRow {
  SpatialDim: string
  TimeDim: number
  Dim1?: string | null
  Dim2?: string | null
  Dim3?: string | null
  NumericValue: number | null
  Value?: string | null
  Low?: number | null
  High?: number | null
}

export interface GhoLatestValue {
  year: number
  value: number
  display: string
  low?: number
  high?: number
}

export interface IndicatorDef {
  key: string
  code: string
  label: string
  unit: string
  /** Multiply NumericValue (e.g. population in thousands). */
  scale?: number
}

/** WHO Global Health Estimates — top causes of death, Pakistan, both sexes, 2021 (data.who.int). */
export const WHO_LEADING_CAUSES_GHE_2021 = [
  { key: 'ischaemic_heart', label: 'Ischaemic heart disease', deathsPer100k: 90.2, year: 2021 },
  { key: 'covid_19', label: 'COVID-19', deathsPer100k: 54.4, year: 2021 },
  { key: 'stroke', label: 'Stroke', deathsPer100k: 47.7, year: 2021 },
  { key: 'prematurity', label: 'Preterm birth complications', deathsPer100k: 40.1, year: 2021 },
  { key: 'birth_asphyxia', label: 'Birth asphyxia and birth trauma', deathsPer100k: 36.4, year: 2021 },
  { key: 'copd', label: 'Chronic obstructive pulmonary disease', deathsPer100k: 28.9, year: 2021 },
  { key: 'lower_respiratory', label: 'Lower respiratory infections', deathsPer100k: 27.2, year: 2021 },
  { key: 'diabetes', label: 'Diabetes mellitus', deathsPer100k: 23.0, year: 2021 },
  { key: 'tuberculosis', label: 'Tuberculosis', deathsPer100k: 22.2, year: 2021 },
] as const

export const WHO_CAUSES_SOURCE_YEAR = 2021

/** Fallback when GHO has no population series for PAK (UNDESA via data.who.int, 2023). */
export const WHO_PAKISTAN_POPULATION_FALLBACK = {
  key: 'population',
  label: 'Population',
  unit: 'people',
  year: 2023,
  value: 247_504_495,
  displayValue: '247.5 million',
}

export const KPI_INDICATORS: IndicatorDef[] = [
  {
    key: 'life_expectancy',
    code: 'WHOSIS_000001',
    label: 'Life expectancy at birth',
    unit: 'years',
  },
  {
    key: 'population',
    code: 'WHS9_86',
    label: 'Population',
    unit: 'people',
    scale: 1000,
  },
  {
    key: 'health_expenditure_gdp',
    code: 'GHED_CHEGDP_SHA2011',
    label: 'Current health expenditure (% of GDP)',
    unit: '%',
  },
  {
    key: 'maternal_mortality',
    code: 'MDG_0000000026',
    label: 'Maternal mortality ratio',
    unit: 'per 100 000 live births',
  },
  {
    key: 'under_five_mortality',
    code: 'MDG_0000000007',
    label: 'Under-five mortality rate',
    unit: 'per 1 000 live births',
  },
  {
    key: 'tb_incidence',
    code: 'MDG_0000000020',
    label: 'Tuberculosis incidence',
    unit: 'per 100 000 population',
  },
  {
    key: 'malaria_incidence',
    code: 'MALARIA_EST_INCIDENCE',
    label: 'Estimated malaria incidence',
    unit: 'per 1 000 population at risk',
  },
  {
    key: 'ncd_premature_risk',
    code: 'NCDMORT3070',
    label: 'Probability of dying from NCDs (age 30–70)',
    unit: '%',
  },
]

/** Pick national aggregate row (not wealth/age breakdowns). */
export function pickRowNational(rows: GhoRow[]): GhoRow | null {
  if (!rows.length) return null
  const sorted = [...rows].sort((a, b) => b.TimeDim - a.TimeDim)
  const latestYear = sorted[0].TimeDim
  const yearRows = sorted.filter((r) => r.TimeDim === latestYear && r.NumericValue != null)

  const childNational = yearRows.find(
    (r) =>
      r.Dim1 === 'SEX_BTSX' &&
      r.Dim2 === CHILD_AGE_UNDER5 &&
      r.Dim3 === NATIONAL_WEALTH_TOTAL,
  )
  if (childNational) return childNational

  const bothSexSimple = yearRows.find((r) => r.Dim1 === 'SEX_BTSX' && !r.Dim2 && !r.Dim3)
  if (bothSexSimple) return bothSexSimple

  const countryLevel = yearRows.find((r) => !r.Dim1 && !r.Dim2 && !r.Dim3)
  if (countryLevel) return countryLevel

  const bothSexAny = yearRows.find((r) => r.Dim1 === 'SEX_BTSX')
  if (bothSexAny) return bothSexAny

  return sorted.find((r) => r.NumericValue != null) ?? null
}

export async function fetchGhoLatest(indicatorCode: string): Promise<GhoLatestValue | null> {
  const filter = encodeURIComponent(`SpatialDim eq '${PAKISTAN_CODE}'`)
  const url =
    `${GHO_API_BASE}/${indicatorCode}?$filter=${filter}&$orderby=TimeDim desc&$top=40`

  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    console.warn(`GHO ${indicatorCode}: HTTP ${res.status}`)
    return null
  }

  const json = (await res.json()) as { value?: GhoRow[] }
  const row = pickRowNational(json.value ?? [])
  if (!row || row.NumericValue == null) return null

  return {
    year: row.TimeDim,
    value: row.NumericValue,
    display: row.Value ?? String(row.NumericValue),
    low: row.Low ?? undefined,
    high: row.High ?? undefined,
  }
}

export async function fetchIndicatorBundle(
  defs: IndicatorDef[],
): Promise<Map<string, GhoLatestValue | null>> {
  const entries = await Promise.all(
    defs.map(async (def) => [def.key, await fetchGhoLatest(def.code)] as const),
  )
  return new Map(entries)
}
