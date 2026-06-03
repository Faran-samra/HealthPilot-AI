import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ExternalLink, MapPin, Navigation, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { DiscoveryDoctor } from '@/types/discovery'
import {
  facilityBadgeDisplay,
  formatFacilityDetailAddress,
  formatFacilityShortLocation,
} from '@/utils/facilityDisplay'
import { getDirectionsUrl, getOpenStreetMapUrl } from '@/utils/mapUtils'
import type { MapPoint } from '@/utils/mapUtils'

interface DiscoveryDoctorCardProps {
  doctor: DiscoveryDoctor
  userLocation?: MapPoint | null
}

export function DiscoveryDoctorCard({ doctor, userLocation }: DiscoveryDoctorCardProps) {
  const { t, i18n } = useTranslation()
  const point = { lat: doctor.latitude, lng: doctor.longitude }
  const lang = i18n.language
  const { typeLabel, specialtyLabel } = facilityBadgeDisplay(doctor, t)
  const shortLocation = formatFacilityShortLocation(doctor, lang)
  const detailAddress = formatFacilityDetailAddress(doctor, lang)

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold leading-snug">{doctor.full_name}</h3>
            {doctor.hospital_name &&
              doctor.facility_type !== 'hospital' &&
              doctor.hospital_name !== doctor.full_name && (
                <p className="mt-0.5 text-sm text-muted-foreground">{doctor.hospital_name}</p>
              )}
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">
            {typeLabel}
          </Badge>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {specialtyLabel && <Badge variant="secondary">{specialtyLabel}</Badge>}
          <Badge variant="secondary" className="text-xs">
            {t('doctors.osmListing')}
          </Badge>
        </div>

        <div className="mb-3 space-y-1 text-sm text-muted-foreground">
          {shortLocation && (
            <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
              <MapPin className="size-3.5 shrink-0" />
              <span>{shortLocation}</span>
              <span className="font-medium text-primary">· {doctor.distance_km.toFixed(1)} km</span>
            </p>
          )}
          {detailAddress && detailAddress !== shortLocation && (
            <p className="text-xs leading-relaxed">{detailAddress}</p>
          )}
          {!detailAddress && !shortLocation && (
            <p className="flex items-center gap-1 text-xs italic">
              <MapPin className="size-3.5" />
              {t('facilities.mapPinOnly')}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to={`/places/${doctor.id}`} state={{ place: doctor }}>
            <Button size="sm" variant="secondary">
              {t('doctors.viewDetails')}
            </Button>
          </Link>

          <a
            href={getDirectionsUrl(point, userLocation ?? undefined)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" variant="outline" className="gap-1">
              <Navigation className="size-3.5" />
              {t('common.directions')}
            </Button>
          </a>

          <a href={getOpenStreetMapUrl(point)} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="gap-1">
              <ExternalLink className="size-3.5" />
              {t('doctors.openInOsm')}
            </Button>
          </a>

          {doctor.phone && (
            <a href={`tel:${doctor.phone}`}>
              <Button size="sm" variant="ghost" className="gap-1">
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
