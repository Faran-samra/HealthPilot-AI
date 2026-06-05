import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapPin, Navigation, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { findNearbyDoctors } from '@/services/doctorService'
import { toDirectoryDoctor, type DirectoryDoctor } from '@/types/doctorDirectory'
import { getDisplayWorkplace } from '@/utils/doctorWorkplace'
import type { SymptomAnalysisExtended } from '@/types/symptomChat'
import type { CareLocation } from '@/utils/locationUtils'
import { buildDoctorSearchUrl } from '@/utils/locationUtils'
import { formatPKR } from '@/utils/formatters'
import { rankDoctorsForSymptomSpecialty } from '@/utils/doctorSpecialtyRank'

interface Props {
  analysis: SymptomAnalysisExtended
  careLocation: CareLocation | null
  locationLoading?: boolean
}

export function RecommendedDirectoryDoctorsPanel({
  analysis,
  careLocation,
  locationLoading,
}: Props) {
  const { t } = useTranslation()
  const [doctors, setDoctors] = useState<DirectoryDoctor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!careLocation) return

    let cancelled = false

    async function load() {
      setLoading(true)
      const loc = careLocation!
      try {
        const slug = analysis.recommended_specialty_slug
        let results = await findNearbyDoctors({
          city: loc.citySlug,
          specialty: slug,
          latitude: loc.latitude,
          longitude: loc.longitude,
          radiusKm: 25,
        })
        if (!cancelled && results.length < 2 && slug === 'cardiology') {
          const general = await findNearbyDoctors({
            city: loc.citySlug,
            specialty: 'general',
            latitude: loc.latitude,
            longitude: loc.longitude,
            radiusKm: 25,
          })
          const seen = new Set(results.map((d) => d.id))
          results = [...results, ...general.filter((d) => !seen.has(d.id))]
        }
        if (!cancelled) {
          const ranked = rankDoctorsForSymptomSpecialty(results, slug)
          setDoctors(ranked.slice(0, 4).map((r) => toDirectoryDoctor(r)))
        }
      } catch {
        if (!cancelled) setDoctors([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [analysis.recommended_specialty_slug, careLocation])

  if (locationLoading || !careLocation) {
    return (
      <div className="flex justify-center py-4">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (doctors.length === 0) return null

  const locationHint =
    careLocation.source === 'gps'
      ? t('symptoms.doctorsNearGps', { city: careLocation.cityLabel })
      : t('symptoms.doctorsNearCity', { city: careLocation.cityLabel })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Stethoscope className="size-4 text-primary" />
          {t('symptoms.recommendedDoctors')}
        </h3>
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
        {doctors.map((doc) => (
          <Card key={doc.id}>
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{doc.full_name}</p>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {doc.specialty}
                  </Badge>
                  {(doc.verification_status === 'verified' ||
                    doc.verification_status === 'cross_verified') && (
                    <Badge className="shrink-0 text-xs">{t('directory.verified')}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {getDisplayWorkplace(doc) ?? doc.city}
                  {doc.consultation_fee != null && (
                    <> · {formatPKR(doc.consultation_fee)}</>
                  )}
                  {doc.distance_precise && doc.distance_km != null && (
                    <> · {doc.distance_km.toFixed(1)} km</>
                  )}
                </p>
              </div>
              <Link to={`/doctors/${doc.id}`}>
                <Button size="sm" variant="outline">{t('directory.viewProfile')}</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      <Link
        to={buildDoctorSearchUrl({
          specialty: analysis.recommended_specialty_slug,
          city: careLocation.citySlug,
          nearMe: careLocation.source === 'gps',
        })}
      >
        <Button variant="link" size="sm" className="h-auto p-0">
          {t('symptoms.viewAllDoctors')}
        </Button>
      </Link>
    </div>
  )
}
