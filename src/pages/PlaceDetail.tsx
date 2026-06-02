import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ExternalLink, MapPin, Navigation, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DoctorLocationMap } from '@/components/doctors/DoctorLocationMap'
import { useGeolocation } from '@/hooks/useGeolocation'
import { fetchLiveFacilityById } from '@/services/liveCareDiscoveryService'
import type { DiscoveryDoctor, FacilityType } from '@/types/discovery'
import { getDirectionsUrl, getOpenStreetMapUrl } from '@/utils/mapUtils'

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

export default function PlaceDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { location: userLocation } = useGeolocation()
  const statePlace = (location.state as { place?: DiscoveryDoctor })?.place

  const [place, setPlace] = useState<DiscoveryDoctor | null>(
    statePlace && statePlace.id === id ? statePlace : null
  )
  const [loading, setLoading] = useState(!place && !!id)

  useEffect(() => {
    if (!id) return
    if (statePlace && statePlace.id === id) {
      setPlace(statePlace)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetchLiveFacilityById(id)
      .then((fetched) => {
        if (!cancelled) setPlace(fetched)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [id, statePlace])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!place) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-muted-foreground">{t('doctors.placeNotFound')}</p>
        <Link to="/healthcare-facilities"><Button variant="link">{t('doctors.backToFacilities')}</Button></Link>
      </div>
    )
  }

  const point = { lat: place.latitude, lng: place.longitude }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/healthcare-facilities" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />{t('doctors.backToFacilities')}
      </Link>

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge>{place.specialty}</Badge>
        <Badge variant="outline">{t(facilityTypeKey(place.facility_type))}</Badge>
        <Badge variant="secondary">{t('doctors.osmListing')}</Badge>
      </div>

      <h1 className="mb-2 text-2xl font-bold">{place.full_name}</h1>
      {place.hospital_name && place.facility_type !== 'hospital' && (
        <p className="mb-4 text-muted-foreground">{place.hospital_name}</p>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t('doctors.location')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            {[place.address, place.area, place.city].filter(Boolean).join(', ')}
          </p>
          {place.distance_km > 0 && (
            <p className="text-sm font-medium text-primary">
              {place.distance_km.toFixed(1)} km {t('doctors.fromYou')}
            </p>
          )}
          <DoctorLocationMap lat={place.latitude} lng={place.longitude} label={place.full_name} />
          <div className="flex flex-wrap gap-2">
            <a href={getDirectionsUrl(point, userLocation ?? undefined)} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-1">
                <Navigation className="size-3.5" />{t('common.directions')}
              </Button>
            </a>
            <a href={getOpenStreetMapUrl(point)} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="gap-1">
                <ExternalLink className="size-3.5" />{t('doctors.openInOsm')}
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {place.phone && (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between py-4">
            <span className="text-sm">{place.phone}</span>
            <a href={`tel:${place.phone}`}>
              <Button size="sm" className="gap-1">
                <Phone className="size-3.5" />{t('common.call')}
              </Button>
            </a>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">{t('doctors.osmDisclaimer')}</p>
    </div>
  )
}
