import type { Doctor } from '@/lib/database.types'
import { parseProfileDetails } from '@/types/doctorProfile'
import { getWhatsAppBookingLink } from '@/utils/appointmentUtils'

export function getDoctorWhatsAppNumber(
  doctor: Pick<Doctor, 'whatsapp'> & { profile_details?: unknown }
): string | null {
  const details = parseProfileDetails(doctor.profile_details)
  const raw = doctor.whatsapp ?? details.marham_whatsapp
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 10 ? digits : null
}

/** Marham-style inquiry message */
export function getMarhamInquiryMessage(doctor: Pick<Doctor, 'full_name' | 'specialty'>): string {
  return `Hi, mujhe ${doctor.full_name} ki speciality ${doctor.specialty} sy related information chahiye`
}

export function getWhatsAppBookingMessage(
  doctor: Pick<Doctor, 'full_name' | 'specialty'>,
  options?: { date?: string; time?: string; workplace?: string | null }
): string {
  let msg = `Assalam o Alaikum, I would like to book an appointment with ${doctor.full_name}`
  if (options?.date && options?.time) {
    msg += ` on ${options.date} at ${options.time}`
  }
  msg += `. Specialty: ${doctor.specialty}.`
  if (options?.workplace) msg += ` Clinic: ${options.workplace}.`
  return msg
}

export function getDoctorWhatsAppLink(
  doctor: Pick<Doctor, 'full_name' | 'specialty' | 'whatsapp'> & { profile_details?: unknown },
  message: string
): string | null {
  const number = getDoctorWhatsAppNumber(doctor)
  if (!number) return null
  return getWhatsAppBookingLink(number, message)
}
