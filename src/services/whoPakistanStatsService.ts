import { supabase } from '@/lib/supabase'
import type { WhoPakistanStatsResponse } from '@/types/whoStats'

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
  return data
}
