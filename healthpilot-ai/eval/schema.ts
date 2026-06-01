export type EvalLanguage = 'en' | 'ur' | 'roman-ur'

export interface EvalExpected {
  severity_level: 'mild' | 'moderate' | 'severe' | 'emergency'
  recommended_specialty_slug: string
  /** Accept any of these slugs (e.g. general OR ent) */
  specialty_slugs_acceptable?: string[]
  must_include_red_flag?: boolean
  min_severity?: 'mild' | 'moderate' | 'severe' | 'emergency'
}

export interface EvalCase {
  id: string
  language: EvalLanguage
  symptoms: string
  user_age?: number
  user_gender?: string
  expected: EvalExpected
}

export interface EvalRunResult {
  caseId: string
  passed: boolean
  severityMatch: boolean
  specialtyMatch: boolean
  redFlagOk: boolean
  schemaValid: boolean
  latencyMs: number
  actualSeverity?: string
  actualSpecialty?: string
  error?: string
}

export interface EvalSummary {
  total: number
  passed: number
  specialtyAccuracy: number
  severityAccuracy: number
  emergencyRecall: number
  emergencyTotal: number
  schemaValidRate: number
  latencyP50: number
  latencyP95: number
  byLanguage: Record<string, { total: number; specialtyAccuracy: number; severityAccuracy: number }>
}
