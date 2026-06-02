/** WHO Global Health Observatory OData API helpers (Pakistan / PAK). */

export const GHO_API_BASE = 'https://ghoapi.azureedge.net/api'
export const PAKISTAN_CODE = 'PAK'
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export interface GhoRow {
  SpatialDim: string
  TimeDim: number
  Dim1?: string | null
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
    code: 'u5mr',
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

export const LEADING_CAUSE_INDICATORS: IndicatorDef[] = [
  {
    key: 'ischaemic_heart',
    code: 'SA_0000001444',
    label: 'Ischaemic heart disease',
    unit: 'per 100 000',
  },
  {
    key: 'stroke',
    code: 'SA_0000001690',
    label: 'Stroke (cerebrovascular disease)',
    unit: 'per 100 000',
  },
  {
    key: 'diabetes',
    code: 'SA_0000001440',
    label: 'Diabetes mellitus',
    unit: 'per 100 000',
  },
  {
    key: 'liver_cirrhosis',
    code: 'SA_0000001446',
    label: 'Cirrhosis of the liver',
    unit: 'per 100 000',
  },
  {
    key: 'tb_deaths',
    code: 'MDG_0000000017',
    label: 'Deaths due to tuberculosis (HIV-negative)',
    unit: 'per 100 000',
  },
  {
    key: 'prematurity',
    code: 'SA_0000001451',
    label: 'Prematurity and low birth weight',
    unit: 'per 100 000',
  },
  {
    key: 'road_injury',
    code: 'SA_0000001452',
    label: 'Road traffic accidents',
    unit: 'per 100 000',
  },
  {
    key: 'breast_cancer',
    code: 'SA_0000001438',
    label: 'Breast cancer',
    unit: 'per 100 000',
  },
]

function pickRow(rows: GhoRow[]): GhoRow | null {
  if (!rows.length) return null
  return (
    rows.find((r) => r.Dim1 === 'SEX_BTSX') ??
    rows.find((r) => !r.Dim1) ??
    rows[0]
  )
}

export async function fetchGhoLatest(indicatorCode: string): Promise<GhoLatestValue | null> {
  const filter = encodeURIComponent(`SpatialDim eq '${PAKISTAN_CODE}'`)
  const url =
    `${GHO_API_BASE}/${indicatorCode}?$filter=${filter}&$orderby=TimeDim desc&$top=15`

  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    console.warn(`GHO ${indicatorCode}: HTTP ${res.status}`)
    return null
  }

  const json = (await res.json()) as { value?: GhoRow[] }
  const row = pickRow(json.value ?? [])
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
