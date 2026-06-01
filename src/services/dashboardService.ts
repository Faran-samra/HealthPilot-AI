import { supabase } from '@/lib/supabase'
import type { SymptomSession, Appointment, AIAnalysisResult } from '@/lib/database.types'

export interface DashboardStats {
  totalAppointments: number
  completedAppointments: number
  symptomSessions: number
  upcomingCount: number
  mostVisitedSpecialty: string | null
}

export async function getUserSymptomSessions(userId: string, limit = 5): Promise<SymptomSession[]> {
  const { data, error } = await supabase
    .from('symptom_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const [appointmentsRes, sessionsRes] = await Promise.all([
    supabase.from('appointments').select('status, doctor_id').eq('patient_id', userId),
    supabase.from('symptom_sessions').select('suggested_specialty').eq('user_id', userId),
  ])

  if (appointmentsRes.error) throw appointmentsRes.error
  if (sessionsRes.error) throw sessionsRes.error

  const appointments = appointmentsRes.data ?? []
  const sessions = sessionsRes.data ?? []

  const completed = appointments.filter((a) => a.status === 'completed').length
  const upcoming = appointments.filter(
    (a) => a.status === 'pending' || a.status === 'confirmed'
  ).length

  const specialtyCounts: Record<string, number> = {}
  for (const session of sessions) {
    if (session.suggested_specialty) {
      specialtyCounts[session.suggested_specialty] =
        (specialtyCounts[session.suggested_specialty] ?? 0) + 1
    }
  }

  const mostVisitedSpecialty =
    Object.entries(specialtyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    totalAppointments: appointments.length,
    completedAppointments: completed,
    symptomSessions: sessions.length,
    upcomingCount: upcoming,
    mostVisitedSpecialty,
  }
}

export function parseSessionAnalysis(session: SymptomSession): AIAnalysisResult | null {
  if (!session.ai_analysis || typeof session.ai_analysis !== 'object') return null
  return session.ai_analysis as unknown as AIAnalysisResult
}

export function getUpcomingAppointments(appointments: Appointment[], limit = 3): Appointment[] {
  const today = new Date().toISOString().split('T')[0]
  return appointments
    .filter(
      (a) =>
        (a.status === 'pending' || a.status === 'confirmed') &&
        a.appointment_date >= today
    )
    .sort((a, b) => {
      const da = `${a.appointment_date}T${a.appointment_time}`
      const db = `${b.appointment_date}T${b.appointment_time}`
      return da.localeCompare(db)
    })
    .slice(0, limit)
}
