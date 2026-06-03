import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ExternalLink, MapPin, MessageCircle, Navigation, Phone, Star, Video } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DoctorLocationMap } from '@/components/doctors/DoctorLocationMap'
import { DoctorBadges } from '@/components/doctors/DoctorBadges'
import { DoctorProfileExtras } from '@/components/doctors/DoctorProfileExtras'
import { PmdcBadge } from '@/components/doctors/PmdcBadge'
import { getDoctorById } from '@/services/doctorService'
import {
  directoryDoctorToDoctorPreview,
  useDoctorProfileStore,
  type DoctorDetailLocationState,
} from '@/store/doctorProfileStore'
import { useGeolocation } from '@/hooks/useGeolocation'
import { formatPKR } from '@/utils/formatters'
import { getWhatsAppVideoLink } from '@/utils/appointmentUtils'
import { getDirectionsUrl } from '@/utils/mapUtils'
import { formatDoctorMapLabel, formatDoctorLocation, formatDoctorSpecialty } from '@/utils/doctorDisplay'
import { getDisplayWorkplace } from '@/utils/doctorWorkplace'
import { resolveDoctorMapPosition } from '@/utils/doctorLocationResolve'
import {
  getDoctorWhatsAppLink,
  getMarhamInquiryMessage,
} from '@/utils/doctorWhatsApp'
import { getMarhamCallcenterUrl, isMarhamDoctor } from '@/utils/marhamBooking'
import { bookAppointmentPath, doctorsListPath } from '@/utils/doctorsListSearch'
import type { Doctor } from '@/lib/database.types'

export default function DoctorDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const locationState = useLocation().state as DoctorDetailLocationState | null
  const listBackHref = doctorsListPath(searchParams)
  const bookHref = id ? bookAppointmentPath(id, searchParams) : '#'
  const { location } = useGeolocation()
  const peekProfile = useDoctorProfileStore((s) => s.peek)
  const putProfile = useDoctorProfileStore((s) => s.put)

  const initialDoctor = useMemo(() => {
    if (!id) return null
    const cached = peekProfile(id)
    if (cached) return cached
    const preview = locationState?.directoryDoctor
    if (preview?.id === id) return directoryDoctorToDoctorPreview(preview)
    return null
  }, [id, locationState?.directoryDoctor, peekProfile])

  const [doctor, setDoctor] = useState<Doctor | null>(initialDoctor)
  const [loadingFull, setLoadingFull] = useState(!initialDoctor)

  useEffect(() => {
    if (!id) return
    const cached = peekProfile(id)
    if (cached) {
      setDoctor(cached)
      setLoadingFull(false)
      return
    }
    const preview = locationState?.directoryDoctor
    if (preview?.id === id) {
      setDoctor(directoryDoctorToDoctorPreview(preview))
      setLoadingFull(false)
    }
    getDoctorById(id)
      .then((full) => {
        if (full) {
          setDoctor(full)
          putProfile(id, full)
        }
      })
      .catch(() => toast.error(t('doctors.notFound')))
      .finally(() => setLoadingFull(false))
  }, [id, locationState?.directoryDoctor, peekProfile, putProfile, t])

  if (loadingFull && !doctor) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6 h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="space-y-4 rounded-xl border p-6">
          <div className="h-7 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-12 animate-pulse rounded bg-muted" />
            <div className="h-12 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    )
  }

  if (!doctor) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-muted-foreground">{t('doctors.notFound')}</p>
        <Link to={doctorsListPath()}><Button variant="link">{t('doctors.backToSearch')}</Button></Link>
      </div>
    )
  }

  const mapPosition = resolveDoctorMapPosition(doctor)
  const doctorPoint = { lat: mapPosition.lat, lng: mapPosition.lng }
  const workplace = getDisplayWorkplace(doctor)
  const locationLine = formatDoctorLocation(doctor)
  const mapLabel = formatDoctorMapLabel(doctor)
  const marhamBookingUrl = getMarhamCallcenterUrl(doctor.source_url)
  const usesMarhamBooking = isMarhamDoctor(doctor) && Boolean(marhamBookingUrl)
  const whatsappInquiry =
    !usesMarhamBooking && getDoctorWhatsAppLink(doctor, getMarhamInquiryMessage(doctor))

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        to={listBackHref}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t('doctors.backToDoctors')}
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-xl">{doctor.full_name}</CardTitle>
              {doctor.qualification && (
                <p className="text-muted-foreground">{doctor.qualification}</p>
              )}
            </div>
            <PmdcBadge pmdcNumber={doctor.pmdc_number} isVerified={doctor.is_verified} showVerifyLink={false} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{formatDoctorSpecialty(doctor.specialty, doctor.specialty_slug)}</Badge>
            <DoctorBadges
              isVerified={doctor.is_verified}
              pmdcNumber={doctor.pmdc_number}
              gender={doctor.gender}
              acceptsOnline={doctor.accepts_online}
            />
          </div>

          <DoctorLocationMap lat={doctorPoint.lat} lng={doctorPoint.lng} label={mapLabel} />

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">{t('doctors.hospital')}</p>
              <p className="font-medium">{workplace ?? t('doctors.contactClinic')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('doctors.experience')}</p>
              <p className="font-medium">
                {doctor.experience_years != null
                  ? `${doctor.experience_years} ${t('doctors.years')}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('doctors.fee')}</p>
              <p className="font-medium">
                {doctor.consultation_fee != null
                  ? formatPKR(doctor.consultation_fee)
                  : t('doctors.contactClinic')}
              </p>
            </div>
            {doctor.total_reviews > 0 && (
              <div>
                <p className="text-muted-foreground">{t('doctors.rating')}</p>
                <p className="flex items-center gap-1 font-medium">
                  <Star className="size-4 fill-yellow-400 text-yellow-400" />
                  {doctor.rating} ({doctor.total_reviews} {t('doctors.reviews')})
                </p>
              </div>
            )}
          </div>

          {locationLine && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p>{locationLine}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {usesMarhamBooking && marhamBookingUrl ? (
              <>
                <a href={marhamBookingUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="gap-1">
                    <ExternalLink className="size-4" />
                    {t('doctors.bookOnMarham')}
                  </Button>
                </a>
                <Link to={bookHref}>
                  <Button variant="outline">{t('doctors.bookAppointment')}</Button>
                </Link>
              </>
            ) : (
              <Link to={bookHref}>
                <Button>{t('doctors.bookAppointment')}</Button>
              </Link>
            )}
            {whatsappInquiry && (
              <a href={whatsappInquiry} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-1">
                  <MessageCircle className="size-4" />
                  {t('doctors.getInTouchWhatsApp')}
                </Button>
              </a>
            )}
            <a href={getDirectionsUrl(doctorPoint, location ?? undefined)} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-1">
                <Navigation className="size-4" />
                {t('doctors.getDirections')}
              </Button>
            </a>
            {doctor.accepts_online && doctor.whatsapp && (
              <a
                href={getWhatsAppVideoLink(doctor.whatsapp, doctor.full_name)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="gap-1">
                  <Video className="size-4" />
                  {t('doctors.videoConsult')}
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

      {loadingFull && !doctor.profile_details ? (
        <div className="mt-6 space-y-3 rounded-xl border p-4">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-16 animate-pulse rounded bg-muted" />
          <div className="h-16 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <DoctorProfileExtras
          profileDetails={doctor.profile_details}
          availableTimes={doctor.available_times}
        />
      )}
    </div>
  )
}
