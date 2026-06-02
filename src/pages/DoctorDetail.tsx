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
import { DoctorProfileExtras } from '@/components/doctors/DoctorProfileExtras'
import { PmdcBadge } from '@/components/doctors/PmdcBadge'
import { getDoctorById } from '@/services/doctorService'
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
import type { Doctor } from '@/lib/database.types'

export default function DoctorDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { location } = useGeolocation()
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getDoctorById(id)
      .then(setDoctor)
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

  const mapPosition = resolveDoctorMapPosition(doctor)
  const doctorPoint = { lat: mapPosition.lat, lng: mapPosition.lng }
  const workplace = getDisplayWorkplace(doctor)
  const locationLine = formatDoctorLocation(doctor)
  const mapLabel = formatDoctorMapLabel(doctor)
  const whatsappInquiry = getDoctorWhatsAppLink(doctor, getMarhamInquiryMessage(doctor))

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
            <Link to={`/doctors/${doctor.id}/book`}>
              <Button>{t('doctors.bookAppointment')}</Button>
            </Link>
            {whatsappInquiry && (
              <a href={whatsappInquiry} target="_blank" rel="noopener noreferrer">
                <Button variant="default" className="gap-1 bg-[#25D366] hover:bg-[#20bd5a]">
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

      <DoctorProfileExtras
        profileDetails={doctor.profile_details}
        availableTimes={doctor.available_times}
      />
    </div>
  )
}
