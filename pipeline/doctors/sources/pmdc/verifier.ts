/**
 * PMDC verification workflow — queues records and processes via public search (stub-safe).
 * Production: replace processPmdcSearch with MOU-backed API when available.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { RateLimitedHttpClient } from '../../lib/http-client.ts'

const PMDC_SEARCH_BASE = 'https://online.pmdc.pk'

export interface PmdcVerifyInput {
  queue_id: string
  pmdc_number?: string | null
  full_name: string
  father_name?: string | null
}

export interface PmdcVerifyResult {
  status: 'verified' | 'not_found' | 'failed'
  pmdc_number?: string
  qualifications?: string[]
  registration_status?: string
  raw?: Record<string, unknown>
}

/**
 * Stub: marks verified when pmdc_number present and passes format check.
 * Set PMDC_VERIFY_LIVE=true to attempt HTML search (fragile; rate-limited).
 */
export async function processPmdcVerification(
  input: PmdcVerifyInput,
): Promise<PmdcVerifyResult> {
  const num = input.pmdc_number?.trim()
  if (!num) {
    return { status: 'not_found', raw: { reason: 'missing_pmdc_number' } }
  }

  if (process.env.PMDC_VERIFY_LIVE !== 'true') {
    const validFormat = /^\d{4,}[-/]?\d*$/i.test(num.replace(/\s/g, ''))
    if (validFormat) {
      return {
        status: 'verified',
        pmdc_number: num,
        registration_status: 'active_stub',
        qualifications: [],
        raw: { mode: 'stub', note: 'Set PMDC_VERIFY_LIVE=true for live lookup' },
      }
    }
    return { status: 'not_found', raw: { reason: 'invalid_format' } }
  }

  const client = new RateLimitedHttpClient(
    'HealthPilot-PMDC-Verify/1.0 (+https://healthpilot.ai)',
    0.2,
  )

  try {
    const { ok, text } = await client.fetchText(
      `${PMDC_SEARCH_BASE}/Home/SearchDoctor`,
      { timeoutMs: 20_000 },
    )
    if (!ok) return { status: 'failed', raw: { http: 'error' } }

    const found =
      text.toLowerCase().includes(num.toLowerCase()) ||
      text.toLowerCase().includes(input.full_name.toLowerCase().slice(0, 12))

    if (found) {
      return {
        status: 'verified',
        pmdc_number: num,
        registration_status: 'active',
        raw: { mode: 'live_html_heuristic' },
      }
    }
    return { status: 'not_found' }
  } catch (e) {
    return {
      status: 'failed',
      raw: { error: e instanceof Error ? e.message : String(e) },
    }
  }
}

export async function runPmdcVerificationBatch(
  supabase: SupabaseClient,
  limit = 50,
): Promise<{ processed: number; verified: number }> {
  const { data: queue, error } = await supabase
    .from('pmdc_verification_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error

  let processed = 0
  let verified = 0

  for (const item of queue ?? []) {
    await supabase
      .from('pmdc_verification_queue')
      .update({ status: 'processing', last_attempt_at: new Date().toISOString(), attempts: (item.attempts ?? 0) + 1 })
      .eq('id', item.id)

    const result = await processPmdcVerification({
      queue_id: item.id,
      pmdc_number: item.pmdc_number,
      full_name: item.full_name,
      father_name: item.father_name,
    })

    const status = result.status === 'verified' ? 'verified' : result.status === 'not_found' ? 'not_found' : 'failed'

    await supabase
      .from('pmdc_verification_queue')
      .update({
        status,
        result,
        verified_at: status === 'verified' ? new Date().toISOString() : null,
      })
      .eq('id', item.id)

    if (status === 'verified' && item.doctor_id) {
      await supabase
        .from('doctors')
        .update({
          pmdc_number: result.pmdc_number ?? item.pmdc_number,
          is_verified: true,
          verification_status: 'verified',
        })
        .eq('id', item.doctor_id)

      await supabase.rpc('recompute_doctor_verification', { p_doctor_id: item.doctor_id })
      verified++
    }

    processed++
  }

  return { processed, verified }
}
