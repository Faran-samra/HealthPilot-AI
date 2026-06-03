import { supabase } from '@/lib/supabase'
import {
  WHO_LEADING_CAUSES_GHE_2021,
  WHO_PAKISTAN_POPULATION_FALLBACK,
} from '@/lib/whoStatsDisplay'
import type { WhoPakistanStatsResponse } from '@/types/whoStats'

function normalizeWhoStats(data: WhoPakistanStatsResponse): WhoPakistanStatsResponse {
  let leadingCauses = data.leadingCauses
  if (!leadingCauses.some((c) => c.key === 'covid_19')) {
    leadingCauses = WHO_LEADING_CAUSES_GHE_2021
  }

  let kpis = data.kpis
  if (!kpis.some((k) => k.key === 'population')) {
    const fb = WHO_PAKISTAN_POPULATION_FALLBACK
    kpis = [
      ...kpis,
      {
        key: fb.key,
        label: fb.label,
        unit: fb.unit,
        year: fb.year,
        value: fb.value,
        displayValue: fb.displayValue,
      },
    ]
  }

  return {
    ...data,
    kpis,
    leadingCauses,
    causesSourceYear: data.causesSourceYear ?? 2021,
  }
}

export async function fetchWhoPakistanStats(
  refresh = false,
): Promise<WhoPakistanStatsResponse> {
  const { data, error } = await supabase.functions.invoke<WhoPakistanStatsResponse>(
    'who-pakistan-stats',
    refresh ? { body: { refresh: true } } : undefined,
  )

  if (error) throw new Error(error.message || 'Failed to load WHO statistics')
  if (!data || data.error) {
    throw new Error(data?.error ?? 'Empty response from WHO statistics service')
  }
  return normalizeWhoStats(data)
}
