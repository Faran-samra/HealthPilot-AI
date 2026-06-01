import { supabase } from '@/lib/supabase'
import type { Review } from '@/lib/database.types'

export interface SubmitReviewInput {
  appointmentId: string
  patientId: string
  doctorId: string
  rating: number
  comment?: string
  isAnonymous?: boolean
}

export async function getDoctorReviews(doctorId: string, limit = 10): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function getReviewForAppointment(appointmentId: string): Promise<Review | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('appointment_id', appointmentId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function submitReview(input: SubmitReviewInput): Promise<Review> {
  const existing = await getReviewForAppointment(input.appointmentId)
  if (existing) throw new Error('You have already reviewed this appointment')

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      appointment_id: input.appointmentId,
      patient_id: input.patientId,
      doctor_id: input.doctorId,
      rating: input.rating,
      comment: input.comment ?? null,
      is_anonymous: input.isAnonymous ?? false,
    })
    .select()
    .single()

  if (error) throw error
  return data
}
