export interface WhoPakistanKpi {
  key: string
  label: string
  unit: string
  year: number
  value: number
  displayValue: string
  low?: number
  high?: number
}

export interface WhoPakistanCause {
  key: string
  label: string
  year: number
  deathsPer100k: number
  displayValue: string
}

export interface WhoPakistanStatsResponse {
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
  kpis: WhoPakistanKpi[]
  leadingCauses: WhoPakistanCause[]
  causesSourceYear?: number
  attribution: {
    source: string
    license: string
    citation: string
    api: string
  }
  error?: string
}
