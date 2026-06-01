import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  BarChart3,
  Calendar,
  Clock,
  Stethoscope,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AppointmentCountdown } from '@/components/appointments/AppointmentCountdown'
import { SymptomSessionCard } from '@/components/dashboard/SymptomSessionCard'
import { RecommendedCheckups } from '@/components/dashboard/RecommendedCheckups'
import { useAuthStore } from '@/store/authStore'
import {
  getDashboardStats,
  getUserSymptomSessions,
  getUpcomingAppointments,
  type DashboardStats,
} from '@/services/dashboardService'
import { getPatientAppointments } from '@/services/bookingService'
import { getDoctorById } from '@/services/doctorService'
import { capitalizeCity, formatDate, formatTime, formatPKR } from '@/utils/formatters'
import type { Appointment, Doctor, SymptomSession } from '@/lib/database.types'

interface UpcomingWithDoctor extends Appointment {
  doctor?: Doctor
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
}

export default function Dashboard() {
  const { t } = useTranslation()
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [sessions, setSessions] = useState<SymptomSession[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingWithDoctor[]>([])

  useEffect(() => {
    if (!user) return

    async function load() {
      try {
        const [statsData, sessionsData, appointments] = await Promise.all([
          getDashboardStats(user!.id),
          getUserSymptomSessions(user!.id, 5),
          getPatientAppointments(user!.id),
        ])

        setStats(statsData)
        setSessions(sessionsData)

        const upcomingAppts = getUpcomingAppointments(appointments, 3)
        const withDoctors = await Promise.all(
          upcomingAppts.map(async (appt) => {
            const doctor = await getDoctorById(appt.doctor_id).catch(() => null)
            return { ...appt, doctor: doctor ?? undefined }
          })
        )
        setUpcoming(withDoctors)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold md:text-3xl">
          {t('dashboard.welcome', {
            name: profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : '',
          })}
        </h1>
        <p className="text-muted-foreground">
          {profile?.city
            ? t('dashboard.subtitleCity', { city: capitalizeCity(profile.city) })
            : t('dashboard.subtitle')}
        </p>
      </div>

      <Card className="mb-8 border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold">{t('dashboard.notFeelingWell')}</h2>
            <p className="text-sm text-muted-foreground">{t('dashboard.checkSymptomsDesc')}</p>
          </div>
          <Link to="/symptom-checker">
            <Button className="gap-2">
              <Stethoscope className="size-4" />
              {t('landing.checkSymptoms')}
            </Button>
          </Link>
        </CardContent>
      </Card>

      {stats && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <BarChart3 className="size-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.completedAppointments}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.statConsultations')}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Activity className="size-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.symptomSessions}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.statSymptomChecks')}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Calendar className="size-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.upcomingCount}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.statUpcoming')}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Stethoscope className="size-8 text-primary" />
              <div>
                <p className="truncate text-sm font-bold">
                  {stats.mostVisitedSpecialty ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">{t('dashboard.statTopSpecialty')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <Clock className="size-4" />
                {t('dashboard.upcomingAppointments')}
              </h2>
              <Link to="/appointments">
                <Button variant="ghost" size="sm">{t('dashboard.viewAll')}</Button>
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  {t('dashboard.noUpcoming')}
                  <Link to="/doctors" className="mt-2 block">
                    <Button variant="outline" size="sm">{t('nav.findDoctors')}</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {upcoming.map((appt) => (
                  <Card key={appt.id}>
                    <CardContent className="p-4">
                      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{appt.doctor?.full_name}</p>
                          <p className="text-sm text-muted-foreground">{appt.doctor?.specialty}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className={statusColors[appt.status] ?? ''}>{appt.status}</Badge>
                          <AppointmentCountdown
                            date={appt.appointment_date}
                            time={appt.appointment_time}
                          />
                        </div>
                      </div>
                      <p className="text-sm">
                        {formatDate(appt.appointment_date)} · {formatTime(appt.appointment_time)}
                      </p>
                      {appt.consultation_fee && (
                        <p className="text-sm font-medium">{formatPKR(appt.consultation_fee)}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <Activity className="size-4" />
              {t('dashboard.symptomHistory')}
            </h2>
            {sessions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  {t('dashboard.noSessions')}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {sessions.map((session) => (
                  <SymptomSessionCard key={session.id} session={session} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <RecommendedCheckups age={profile?.age} gender={profile?.gender} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.quickLinks')}</CardTitle>
              <CardDescription>{t('dashboard.quickLinksDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Link to="/doctors">
                <Button variant="outline" className="w-full justify-start">
                  {t('nav.findDoctors')}
                </Button>
              </Link>
              <Link to="/appointments">
                <Button variant="outline" className="w-full justify-start">
                  {t('nav.appointments')}
                </Button>
              </Link>
              <Link to="/health-info">
                <Button variant="outline" className="w-full justify-start">
                  {t('nav.healthInfo')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
