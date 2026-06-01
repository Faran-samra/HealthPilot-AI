import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Calendar, CheckCircle, Star, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppointmentCountdown } from '@/components/appointments/AppointmentCountdown'
import { ReviewDialog } from '@/components/appointments/ReviewDialog'
import {
  getPatientAppointments,
  cancelAppointment,
  completeAppointment,
  isAppointmentPast,
} from '@/services/bookingService'
import { getDoctorById } from '@/services/doctorService'
import { getReviewForAppointment } from '@/services/reviewService'
import { useAuthStore } from '@/store/authStore'
import { formatDate, formatTime, formatPKR } from '@/utils/formatters'
import type { Appointment, Doctor, Review } from '@/lib/database.types'

interface AppointmentWithDoctor extends Appointment {
  doctor?: Doctor
  review?: Review | null
}

export default function Appointments() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [appointments, setAppointments] = useState<AppointmentWithDoctor[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewTarget, setReviewTarget] = useState<AppointmentWithDoctor | null>(null)

  const loadAppointments = async () => {
    if (!user) return
    try {
      const data = await getPatientAppointments(user.id)
      const enriched = await Promise.all(
        data.map(async (appt) => {
          const [doctor, review] = await Promise.all([
            getDoctorById(appt.doctor_id).catch(() => null),
            getReviewForAppointment(appt.id).catch(() => null),
          ])
          return { ...appt, doctor: doctor ?? undefined, review }
        })
      )
      setAppointments(enriched)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('dashboard.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAppointments()
  }, [user])

  const handleCancel = async (id: string) => {
    try {
      await cancelAppointment(id)
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'cancelled' as const } : a))
      )
      toast.success(t('dashboard.appointmentCancelled'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('dashboard.cancelFailed'))
    }
  }

  const handleComplete = async (id: string) => {
    try {
      await completeAppointment(id)
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'completed' as const } : a))
      )
      toast.success(t('dashboard.notifCompleted'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('dashboard.completeFailed'))
    }
  }

  const upcoming = appointments.filter(
    (a) => a.status !== 'cancelled' && a.status !== 'completed'
  )
  const past = appointments.filter(
    (a) => a.status === 'cancelled' || a.status === 'completed'
  )

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-600',
    completed: 'bg-blue-100 text-blue-800',
    no_show: 'bg-red-100 text-red-800',
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard.myAppointments')}</h1>
          <p className="text-muted-foreground">{t('dashboard.appointmentsDesc')}</p>
        </div>
        <Link to="/doctors">
          <Button variant="outline" size="sm">{t('nav.findDoctors')}</Button>
        </Link>
      </div>

      <section className="mb-8">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <Calendar className="size-4" />
          {t('dashboard.upcoming')}
        </h2>
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t('dashboard.noUpcoming')}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((appt) => (
              <Card key={appt.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{appt.doctor?.full_name ?? 'Doctor'}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={statusColors[appt.status]}>{appt.status}</Badge>
                      <AppointmentCountdown
                        date={appt.appointment_date}
                        time={appt.appointment_time}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{appt.doctor?.specialty}</p>
                  <p>
                    {formatDate(appt.appointment_date)} at {formatTime(appt.appointment_time)}
                  </p>
                  {appt.consultation_fee && <p>{formatPKR(appt.consultation_fee)}</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(appt.status === 'pending' || appt.status === 'confirmed') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-destructive"
                        onClick={() => handleCancel(appt.id)}
                      >
                        <X className="size-3.5" />
                        {t('common.cancel')}
                      </Button>
                    )}
                    {isAppointmentPast(appt.appointment_date, appt.appointment_time) &&
                      appt.status !== 'completed' &&
                      appt.status !== 'cancelled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleComplete(appt.id)}
                        >
                          <CheckCircle className="size-3.5" />
                          {t('dashboard.markCompleted')}
                        </Button>
                      )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-4 font-semibold text-muted-foreground">{t('dashboard.past')}</h2>
          <div className="space-y-3">
            {past.map((appt) => (
              <Card key={appt.id} className="opacity-90">
                <CardContent className="py-4 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{appt.doctor?.full_name}</p>
                    <Badge variant="outline">{appt.status}</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {formatDate(appt.appointment_date)} at {formatTime(appt.appointment_time)}
                  </p>
                  {appt.status === 'completed' && !appt.review && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-1"
                      onClick={() => setReviewTarget(appt)}
                    >
                      <Star className="size-3.5" />
                      {t('dashboard.leaveReview')}
                    </Button>
                  )}
                  {appt.review && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="size-3 fill-yellow-400 text-yellow-400" />
                      {t('dashboard.reviewed', { rating: appt.review.rating })}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {reviewTarget && user && (
        <ReviewDialog
          open={Boolean(reviewTarget)}
          onOpenChange={(open) => !open && setReviewTarget(null)}
          appointmentId={reviewTarget.id}
          patientId={user.id}
          doctorId={reviewTarget.doctor_id}
          doctorName={reviewTarget.doctor?.full_name ?? 'Doctor'}
          onSubmitted={loadAppointments}
        />
      )}
    </div>
  )
}
