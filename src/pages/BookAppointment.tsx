import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ExternalLink, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getDoctorById } from '@/services/doctorService'
import { createAppointment, createGuestAppointment } from '@/services/bookingService'
import { useAuthStore } from '@/store/authStore'
import { useSymptomStore } from '@/store/symptomStore'
import { formatPKR } from '@/utils/formatters'
import {
  getDoctorWhatsAppLink,
  getMarhamInquiryMessage,
} from '@/utils/doctorWhatsApp'
import { getMarhamCallcenterUrl, isMarhamDoctor } from '@/utils/marhamBooking'
import {
  formatTime12h,
  getPracticeTimingsFromDoctor,
  slotsForDoctorOnDate,
} from '@/utils/practiceTimings'
import type { Doctor } from '@/lib/database.types'
import { doctorDetailPath, doctorsListPath } from '@/utils/doctorsListSearch'
import { cn } from '@/lib/utils'

export default function BookAppointment() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const detailBackHref = id ? doctorDetailPath(id, searchParams) : doctorsListPath(searchParams)
  const listBackHref = doctorsListPath(searchParams)
  const { user } = useAuthStore()
  const { sessionId } = useSymptomStore()
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    getDoctorById(id).then(setDoctor).catch(() => toast.error(t('doctors.notFound')))
  }, [id, t])

  useEffect(() => {
    setTime('')
  }, [date])

  const weeklyTimings = doctor ? getPracticeTimingsFromDoctor(doctor) : []
  const slotResult = useMemo(() => {
    if (!doctor || !date) {
      return { slots: [], dayTiming: null, hasWeeklySchedule: weeklyTimings.length > 0 }
    }
    return slotsForDoctorOnDate(doctor, date)
  }, [doctor, date, weeklyTimings.length])

  const { slots, dayTiming, hasWeeklySchedule } = slotResult
  const marhamBookingUrl = doctor ? getMarhamCallcenterUrl(doctor.source_url) : null
  const usesMarhamBooking = Boolean(doctor && isMarhamDoctor(doctor) && marhamBookingUrl)
  const whatsappInquiryLink =
    doctor && !usesMarhamBooking
      ? getDoctorWhatsAppLink(doctor, getMarhamInquiryMessage(doctor))
      : null

  const handleBook = async () => {
    if (!doctor || !date || !time) {
      toast.error(t('booking.selectDateAndTime'))
      return
    }

    if (!user) {
      if (!guestName.trim() || !guestPhone.trim()) {
        toast.error(t('booking.enterNameAndPhone'))
        return
      }
    }

    if (usesMarhamBooking && !marhamBookingUrl) {
      toast.error(t('booking.marhamMissingProfile'))
      return
    }

    setSubmitting(true)
    try {
      if (user) {
        await createAppointment({
          patientId: user.id,
          doctorId: doctor.id,
          sessionId: sessionId ?? undefined,
          date,
          time,
          notes,
          fee: doctor.consultation_fee ?? undefined,
        })
        toast.success(t('booking.success'))
        if (marhamBookingUrl) {
          window.open(marhamBookingUrl, '_blank', 'noopener,noreferrer')
        }
        navigate('/appointments')
      } else {
        await createGuestAppointment({
          doctorId: doctor.id,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          date,
          time,
          notes,
          fee: doctor.consultation_fee ?? undefined,
        })
        toast.success(t('booking.guestSuccess'))
        if (marhamBookingUrl) {
          window.open(marhamBookingUrl, '_blank', 'noopener,noreferrer')
        } else if (whatsappInquiryLink) {
          window.open(whatsappInquiryLink, '_blank', 'noopener,noreferrer')
        }
        navigate(detailBackHref)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('booking.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link
          to={detailBackHref}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t('doctors.backToProfile')}
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link
          to={listBackHref}
          className="text-muted-foreground hover:text-foreground"
        >
          {t('doctors.backToDoctors')}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('doctors.bookAppointment')}</CardTitle>
          <CardDescription>
            {doctor ? `${doctor.full_name}` : t('common.loading')}
            {doctor?.consultation_fee != null && ` — ${formatPKR(doctor.consultation_fee)}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {doctor && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="mb-2 font-medium">{t('doctors.practiceTimings')}</p>
              {weeklyTimings.length > 0 ? (
                <ul className="space-y-1 text-muted-foreground">
                  {weeklyTimings.map((row) => (
                    <li key={row.day} className="flex justify-between gap-2">
                      <span>{row.day}</span>
                      <span>
                        {formatTime12h(row.start)} – {formatTime12h(row.end)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">{t('booking.noScheduleOnMarham')}</p>
              )}
            </div>
          )}

          {!user && (
            <>
              <div className="space-y-2">
                <Label htmlFor="guestName">{t('booking.yourName')}</Label>
                <Input
                  id="guestName"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={t('booking.namePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guestPhone">{t('booking.mobileNumber')}</Label>
                <Input
                  id="guestPhone"
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="03XX XXXXXXX"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="date">{t('booking.date')}</Label>
            <Input
              id="date"
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('booking.timeSlot')}</Label>
            {!date && (
              <p className="text-sm text-muted-foreground">{t('booking.selectDateFirst')}</p>
            )}
            {date && hasWeeklySchedule && !dayTiming && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {t('booking.closedThisDay')}
              </p>
            )}
            {date && dayTiming && (
              <p className="text-sm text-muted-foreground">
                {t('booking.availableOnDay', {
                  day: dayTiming.day,
                  start: formatTime12h(dayTiming.start),
                  end: formatTime12h(dayTiming.end),
                })}
              </p>
            )}
            {date &&
              doctor?.source === 'marham' &&
              weeklyTimings.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('booking.noScheduleOnMarham')}</p>
              )}
            {date && slots.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.isAvailable}
                    onClick={() => setTime(slot.time)}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-sm transition-colors',
                      time === slot.time && 'border-primary bg-primary/10 text-primary',
                      !slot.isAvailable && 'cursor-not-allowed opacity-40'
                    )}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t('booking.notesOptional')}</Label>
            <textarea
              id="notes"
              className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={t('booking.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {usesMarhamBooking && (
            <p className="text-sm text-muted-foreground">{t('booking.marhamRedirectHint')}</p>
          )}

          {usesMarhamBooking && marhamBookingUrl ? (
            <Button
              type="button"
              className="w-full gap-2"
              onClick={handleBook}
              disabled={submitting || !date || !time}
            >
              <ExternalLink className="size-4" />
              {submitting ? t('booking.submitting') : t('booking.confirmOnMarham')}
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={handleBook}
              disabled={submitting || !date || !time}
            >
              {submitting ? t('booking.submitting') : t('booking.confirm')}
            </Button>
          )}

          {whatsappInquiryLink && (
            <a
              href={whatsappInquiryLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button type="button" variant="outline" className="w-full gap-2">
                <MessageCircle className="size-4" />
                {t('doctors.getInTouchWhatsApp')}
              </Button>
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
