import { supabase } from '@/lib/supabase'
import type { Appointment } from '@/lib/database.types'

export interface CreateAppointmentInput {
  patientId: string
  doctorId: string
  sessionId?: string
  date: string
  time: string
  notes?: string
  fee?: number
}

export async function checkSlotAvailability(
  doctorId: string,
  date: string,
  time: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('appointments')
    .select('id')
    .eq('doctor_id', doctorId)
    .eq('appointment_date', date)
    .eq('appointment_time', time)
    .not('status', 'in', '("cancelled")')

  if (error) throw error
  return (data?.length ?? 0) === 0
}

export interface CreateGuestAppointmentInput {
  doctorId: string
  guestName: string
  guestPhone: string
  date: string
  time: string
  notes?: string
  fee?: number
}

export async function createGuestAppointment(
  data: CreateGuestAppointmentInput
): Promise<Appointment> {
  const { data: appointment, error } = await supabase.rpc('create_guest_appointment', {
    p_doctor_id: data.doctorId,
    p_guest_name: data.guestName,
    p_guest_phone: data.guestPhone,
    p_appointment_date: data.date,
    p_appointment_time: data.time.length === 5 ? `${data.time}:00` : data.time,
    p_patient_notes: data.notes ?? null,
    p_consultation_fee: data.fee ?? null,
  })

  if (error) throw error
  return appointment
}

export async function createAppointment(
  data: CreateAppointmentInput
): Promise<Appointment> {
  const isAvailable = await checkSlotAvailability(data.doctorId, data.date, data.time)
  if (!isAvailable) throw new Error('Slot no longer available')

  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({
      patient_id: data.patientId,
      doctor_id: data.doctorId,
      session_id: data.sessionId ?? null,
      appointment_date: data.date,
      appointment_time: data.time,
      patient_notes: data.notes ?? null,
      consultation_fee: data.fee ?? null,
      booking_method: 'in_app',
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw error
  return appointment
}

export async function getPatientAppointments(patientId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('patient_id', patientId)
    .order('appointment_date', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function cancelAppointment(appointmentId: string): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', appointmentId)

  if (error) throw error
}

export async function completeAppointment(appointmentId: string): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', appointmentId)

  if (error) throw error
}

export function isAppointmentPast(date: string, time: string): boolean {
  const appt = new Date(`${date}T${time}`)
  return appt.getTime() < Date.now()
}
