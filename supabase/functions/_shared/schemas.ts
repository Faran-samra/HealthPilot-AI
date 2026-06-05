import { z } from 'npm:zod'
import { normalizeSymptomAnalysisRaw } from './analysis-normalize.ts'
import { SPECIALTY_SLUGS, SEVERITY_LEVELS } from './models.ts'

export { normalizeSymptomAnalysisRaw } from './analysis-normalize.ts'

export const SymptomAnalysisSchema = z.object({
  primary_condition: z.string().min(1).optional(),
  condition_confidence: z.enum(['high', 'medium', 'low']).optional(),
  brief_summary: z.string().min(1),
  possible_conditions: z.array(z.string()).max(5),
  recommended_specialty: z.string().min(1),
  recommended_specialty_slug: z.enum(SPECIALTY_SLUGS),
  severity_level: z.enum(SEVERITY_LEVELS),
  explanation: z.string().min(1).max(4000),
  first_aid_tips: z.array(z.string()).max(5),
  red_flags: z.array(z.string()).max(5),
  disclaimer: z.string().min(1),
  urdu_summary: z.string().min(1),
})

export type SymptomAnalysis = z.infer<typeof SymptomAnalysisSchema>

export function parseSymptomAnalysis(raw: unknown): {
  success: true
  data: SymptomAnalysis
} | {
  success: false
  error: string
} {
  const normalized = normalizeSymptomAnalysisRaw(raw)
  if (!normalized) {
    return { success: false, error: 'Invalid analysis payload: not an object' }
  }

  const result = SymptomAnalysisSchema.safeParse(normalized)
  if (result.success) return { success: true, data: result.data }
  return { success: false, error: result.error.message }
}
