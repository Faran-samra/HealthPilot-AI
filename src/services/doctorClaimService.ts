import { supabase } from '@/lib/supabase'

export interface SubmitClaimParams {
  doctorId: string
  pmdcNumber?: string
  phone?: string
  evidence?: Record<string, unknown>
}

export async function submitDoctorClaim(params: SubmitClaimParams): Promise<string> {
  const { data, error } = await supabase.rpc('submit_doctor_claim', {
    p_doctor_id: params.doctorId,
    p_pmdc_number: params.pmdcNumber ?? null,
    p_phone: params.phone ?? null,
    p_evidence: params.evidence ?? {},
  })

  if (error) throw error
  return data as string
}

export async function queuePmdcVerification(doctorId: string, pmdcNumber?: string): Promise<string> {
  const { data, error } = await supabase.rpc('queue_pmdc_verification', {
    p_doctor_id: doctorId,
    p_pmdc_number: pmdcNumber ?? null,
  })

  if (error) throw error
  return data as string
}
