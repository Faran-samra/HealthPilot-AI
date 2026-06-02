import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapPin, Phone, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PmdcBadge } from '@/components/doctors/PmdcBadge'
import { formatPKR } from '@/utils/formatters'
import { formatDoctorLocation, formatDoctorSpecialty } from '@/utils/doctorDisplay'
import { getDisplayWorkplace } from '@/utils/doctorWorkplace'
import { resolveDoctorGender } from '@/utils/doctorGender'
import type { DirectoryDoctor } from '@/types/doctorDirectory'

interface Props {
  doctor: DirectoryDoctor
  /** When true, show km from user (Near Me search). */
  showDistance?: boolean
}

function verificationLabel(
  status: DirectoryDoctor['verification_status'],
  t: (k: string) => string
): string | null {
  if (status === 'verified' || status === 'cross_verified') return t('directory.verified')
  if (status === 'community_verified') return t('directory.communityVerified')
  return null
}

function sourceLabel(source: DirectoryDoctor['source'], t: (k: string) => string): string {
  const key = `directory.source.${source}`
  return t(key)
}

export function DirectoryDoctorCard({ doctor, showDistance = false }: Props) {
  const { t } = useTranslation()
  const vLabel = verificationLabel(doctor.verification_status, t)
  const workplace = getDisplayWorkplace(doctor)
  const locationLine = formatDoctorLocation(doctor)
  const displayGender = resolveDoctorGender(doctor.gender, doctor.full_name)

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold">{doctor.full_name}</h3>
            <p className="text-sm text-primary">
              {formatDoctorSpecialty(doctor.specialty, doctor.specialty_slug)}
            </p>
          </div>
          <PmdcBadge pmdcNumber={doctor.pmdc_number} isVerified={doctor.is_verified} showVerifyLink={false} />
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {vLabel && <Badge className="bg-primary/90">{vLabel}</Badge>}
          {displayGender === 'female' && (
            <Badge variant="secondary">{t('common.femaleDoctor')}</Badge>
          )}
          {displayGender === 'male' && (
            <Badge variant="secondary">{t('common.maleDoctor')}</Badge>
          )}
          {doctor.accepts_online && (
            <Badge variant="outline">{t('common.onlineConsult')}</Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {sourceLabel(doctor.source, t)}
          </Badge>
        </div>

        <div className="space-y-1.5 text-sm text-muted-foreground">
          {locationLine && (
            <p className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              {locationLine}
              {showDistance && doctor.distance_km != null && (
                <span className="font-medium text-primary">
                  · {doctor.distance_precise === false ? '~' : ''}
                  {doctor.distance_km.toFixed(1)} km
                  {doctor.distance_precise === false && (
                    <span className="ms-0.5 font-normal text-muted-foreground">
                      ({t('directory.approxDistance')})
                    </span>
                  )}
                </span>
              )}
            </p>
          )}
          {workplace && (
            <p className="flex items-start gap-1.5">
              <Stethoscope className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {t('directory.availableAt')} <span className="text-foreground">{workplace}</span>
              </span>
            </p>
          )}
          {doctor.consultation_fee != null && doctor.consultation_fee > 0 && (
            <p className="font-medium text-foreground">
              {t('directory.consultationFee')}: {formatPKR(doctor.consultation_fee)}
            </p>
          )}
          {doctor.languages?.length ? (
            <p className="text-xs">{t('directory.languages')}: {doctor.languages.join(', ')}</p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link to={`/doctors/${doctor.id}`}>
            <Button size="sm">{t('directory.viewProfile')}</Button>
          </Link>
          {doctor.phone && (
            <a href={`tel:${doctor.phone}`}>
              <Button size="sm" variant="outline" className="gap-1">
                <Phone className="size-3.5" />
                {t('common.call')}
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
