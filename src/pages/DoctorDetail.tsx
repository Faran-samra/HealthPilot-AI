import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, MapPin, MessageCircle, Navigation, Phone, Star, Video } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DoctorLocationMap } from '@/components/doctors/DoctorLocationMap'
import { DoctorBadges } from '@/components/doctors/DoctorBadges'
import { PmdcBadge } from '@/components/doctors/PmdcBadge'
import { getDoctorById } from '@/services/doctorService'
import { getDoctorReviews } from '@/services/reviewService'
import { useGeolocation } from '@/hooks/useGeolocation'
import { formatPKR } from '@/utils/formatters'
import { getWhatsAppBookingLink, getWhatsAppVideoLink } from '@/utils/appointmentUtils'
import { getDirectionsUrl, getOpenStreetMapUrl } from '@/utils/mapUtils'
import { DoctorReviewsList } from '@/components/doctors/DoctorReviewsList'
import type { Doctor, Review } from '@/lib/database.types'

export default function DoctorDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { location } = useGeolocation()
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([getDoctorById(id), getDoctorReviews(id)])
      .then(([doc, revs]) => {
        setDoctor(doc)
        setReviews(revs)
      })
      .catch(() => toast.error(t('doctors.notFound')))
      .finally(() => setLoading(false))
  }, [id, t])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!doctor) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-muted-foreground">{t('doctors.notFound')}</p>
        <Link to="/doctors"><Button variant="link">{t('doctors.backToSearch')}</Button></Link>
      </div>
    )
  }

  const availableTimes = doctor.available_times as { start?: string; end?: string } | null
  const hasCoords = doctor.latitude != null && doctor.longitude != null
  const doctorPoint = hasCoords ? { lat: doctor.latitude!, lng: doctor.longitude! } : null

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/doctors" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t('doctors.backToDoctors')}
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-xl">{doctor.full_name}</CardTitle>
              <p className="text-muted-foreground">{doctor.qualification}</p>
            </div>
            <PmdcBadge pmdcNumber={doctor.pmdc_number} isVerified={doctor.is_verified} showVerifyLink={false} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{doctor.specialty}</Badge>
            <DoctorBadges
              isVerified={doctor.is_verified}
              pmdcNumber={doctor.pmdc_number}
              gender={doctor.gender}
              acceptsOnline={doctor.accepts_online}
            />
          </div>

          {hasCoords && (
            <DoctorLocationMap
              lat={doctor.latitude!}
              lng={doctor.longitude!}
              label={`${doctor.hospital_name} — ${doctor.area}, ${doctor.city}`}
            />
          )}

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">{t('doctors.hospital')}</p>
              <p className="font-medium">{doctor.hospital_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('doctors.experience')}</p>
              <p className="font-medium">{doctor.experience_years ?? '—'} {t('doctors.years')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('doctors.fee')}</p>
              <p className="font-medium">
                {doctor.consultation_fee ? formatPKR(doctor.consultation_fee) : t('doctors.contactClinic')}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('doctors.rating')}</p>
              <p className="flex items-center gap-1 font-medium">
                <Star className="size-4 fill-yellow-400 text-yellow-400" />
                {doctor.rating} ({doctor.total_reviews} {t('doctors.reviews')})
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p>{doctor.address}</p>
              <p className="text-muted-foreground">{doctor.area}, {doctor.city}</p>
            </div>
          </div>

          <PmdcBadge pmdcNumber={doctor.pmdc_number} isVerified={doctor.is_verified} />

          {doctor.available_days && (
            <div>
              <p className="mb-1 text-sm text-muted-foreground">{t('doctors.availableDays')}</p>
              <p className="text-sm">{doctor.available_days.join(', ')}</p>
            </div>
          )}

          {availableTimes?.start && availableTimes?.end && (
            <div>
              <p className="mb-1 text-sm text-muted-foreground">{t('doctors.timings')}</p>
              <p className="text-sm">{availableTimes.start} — {availableTimes.end}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Link to={`/doctors/${doctor.id}/book`}>
              <Button>{t('doctors.bookAppointment')}</Button>
            </Link>
            {doctorPoint && (
              <>
                <a href={getDirectionsUrl(doctorPoint, location ?? undefined)} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-1">
                    <Navigation className="size-4" />
                    {t('doctors.getDirections')}
                  </Button>
                </a>
                <a href={getOpenStreetMapUrl(doctorPoint)} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm">{t('doctors.openInOsm')}</Button>
                </a>
              </>
            )}
            {doctor.accepts_online && doctor.whatsapp && (
              <a href={getWhatsAppVideoLink(doctor.whatsapp, doctor.full_name)} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-1">
                  <Video className="size-4" />
                  {t('doctors.videoConsult')}
                </Button>
              </a>
            )}
            {doctor.whatsapp && (
              <a href={getWhatsAppBookingLink(doctor.whatsapp, `Assalam o Alaikum, I would like to book an appointment with ${doctor.full_name}.`)} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-1">
                  <MessageCircle className="size-4" />
                  {t('common.whatsapp')}
                </Button>
              </a>
            )}
            {doctor.phone && (
              <a href={`tel:${doctor.phone}`}>
                <Button variant="ghost" className="gap-1">
                  <Phone className="size-4" />
                  {t('common.call')}
                </Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">{t('dashboard.patientReviews')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DoctorReviewsList reviews={reviews} />
        </CardContent>
      </Card>
    </div>
  )
}
