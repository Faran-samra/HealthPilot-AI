import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapPin, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { discoverHealthcareFacilities } from '@/services/liveCareDiscoveryService'
import type { DiscoveryDoctor } from '@/types/discovery'
import type { SymptomAnalysisExtended } from '@/types/symptomChat'
import type { CareLocation } from '@/utils/locationUtils'
import { buildHealthcareFacilitiesUrl } from '@/utils/locationUtils'

interface RecommendedDoctorsPanelProps {
  analysis: SymptomAnalysisExtended
  careLocation: CareLocation | null
  locationLoading?: boolean
}

export function RecommendedDoctorsPanel({
  analysis,
  careLocation,
  locationLoading,
}: RecommendedDoctorsPanelProps) {
  const { t } = useTranslation()
  const [facilities, setFacilities] = useState<DiscoveryDoctor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!careLocation) return

    let cancelled = false

    async function load() {
      setLoading(true)
      const loc = careLocation!
      try {
        const { results } = await discoverHealthcareFacilities({
          city: loc.citySlug,
          cityLabel: loc.cityLabel,
          specialty: analysis.recommended_specialty_slug,
          latitude: loc.latitude,
          longitude: loc.longitude,
          radiusKm: 25,
        })
        if (!cancelled) {
          setFacilities(results.slice(0, 4))
        }
      } catch {
        if (!cancelled) setFacilities([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [analysis.recommended_specialty_slug, careLocation])

  if (locationLoading || !careLocation) {
    return (
      <div className="flex justify-center py-6">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (facilities.length === 0) return null

  const locationHint =
    careLocation.source === 'gps'
      ? t('symptoms.facilitiesNearGps', { city: careLocation.cityLabel })
      : t('symptoms.facilitiesNearCity', { city: careLocation.cityLabel })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t('symptoms.recommendedFacilities')}</h3>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {careLocation.source === 'gps' ? (
            <Navigation className="size-3" />
          ) : (
            <MapPin className="size-3" />
          )}
          {locationHint}
        </p>
      </div>
      <div className="space-y-2">
        {facilities.map((place) => (
          <Card key={place.id}>
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{place.full_name}</p>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {place.specialty}
                  </Badge>
                </div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  {place.distance_km.toFixed(1)} km
                </p>
              </div>
              <Link to={`/places/${place.id}`} state={{ place }}>
                <Button size="sm" variant="outline">{t('doctors.viewDetails')}</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      <Link
        to={buildHealthcareFacilitiesUrl({
          specialty: analysis.recommended_specialty_slug,
          city: careLocation.citySlug,
          nearMe: careLocation.source === 'gps',
        })}
      >
        <Button variant="link" size="sm" className="h-auto p-0">
          {t('symptoms.viewAllFacilities')}
        </Button>
      </Link>
    </div>
  )
}
