import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ExternalLink, MapPin, Navigation, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { DiscoveryDoctor, FacilityType } from '@/types/discovery'
import { getDirectionsUrl, getOpenStreetMapUrl } from '@/utils/mapUtils'
import type { MapPoint } from '@/utils/mapUtils'

interface DiscoveryDoctorCardProps {
  doctor: DiscoveryDoctor
  userLocation?: MapPoint | null
}

function facilityTypeKey(type: FacilityType): string {
  const keys: Record<FacilityType, string> = {
    hospital: 'doctors.facilityHospital',
    clinic: 'doctors.facilityClinic',
    doctor: 'doctors.facilityDoctor',
    health_centre: 'doctors.facilityHealthCentre',
    other: 'doctors.facilityOther',
  }
  return keys[type] ?? keys.other
}

export function DiscoveryDoctorCard({ doctor, userLocation }: DiscoveryDoctorCardProps) {
  const { t } = useTranslation()
  const point = { lat: doctor.latitude, lng: doctor.longitude }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">{doctor.full_name}</h3>
            {doctor.hospital_name && doctor.facility_type !== 'hospital' && (
              <p className="text-sm text-muted-foreground">{doctor.hospital_name}</p>
            )}
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">
            {t(facilityTypeKey(doctor.facility_type))}
          </Badge>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <Badge>{doctor.specialty}</Badge>
          <Badge variant="secondary" className="text-xs">
            {t('doctors.osmListing')}
          </Badge>
        </div>

        <div className="mb-3 space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-1">
            <MapPin className="size-3.5" />
            {[doctor.area, doctor.city].filter(Boolean).join(', ') || doctor.address}
            <span className="font-medium text-primary">· {doctor.distance_km.toFixed(1)} km</span>
          </p>
          {doctor.address && doctor.area && <p className="text-xs">{doctor.address}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to={`/places/${doctor.id}`} state={{ place: doctor }}>
            <Button size="sm" variant="secondary">{t('doctors.viewDetails')}</Button>
          </Link>

          <a href={getDirectionsUrl(point, userLocation ?? undefined)} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-1">
              <Navigation className="size-3.5" />{t('common.directions')}
            </Button>
          </a>

          <a href={getOpenStreetMapUrl(point)} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="gap-1">
              <ExternalLink className="size-3.5" />{t('doctors.openInOsm')}
            </Button>
          </a>

          {doctor.phone && (
            <a href={`tel:${doctor.phone}`}>
              <Button size="sm" variant="ghost" className="gap-1">
                <Phone className="size-3.5" />{t('common.call')}
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
