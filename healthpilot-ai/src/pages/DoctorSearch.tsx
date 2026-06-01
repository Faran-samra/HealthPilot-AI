import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Globe, List, Map, MapPin, Navigation } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DoctorsMap } from '@/components/doctors/DoctorsMap'
import { DiscoveryDoctorCard } from '@/components/doctors/DiscoveryDoctorCard'
import { discoverLiveCare } from '@/services/liveCareDiscoveryService'
import { useAuthStore } from '@/store/authStore'
import { useGeolocation } from '@/hooks/useGeolocation'
import {
  PAKISTAN_CITIES,
  FAMOUS_HOSPITALS,
  MEDICAL_SPECIALTIES,
} from '@/utils/constants'
import { resolveSearchLocation } from '@/utils/locationUtils'
import type { DiscoveryDoctor, DiscoveryMeta } from '@/types/discovery'

export default function DoctorSearch() {
  const { t } = useTranslation()
  const { profile } = useAuthStore()
  const { location, loading: locating, error: locationError, requestLocation, clearLocation } =
    useGeolocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [doctors, setDoctors] = useState<DiscoveryDoctor[]>([])
  const [meta, setMeta] = useState<DiscoveryMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [useNearMe, setUseNearMe] = useState(searchParams.get('nearMe') === '1')

  const resolved = useMemo(
    () => resolveSearchLocation(searchParams, profile),
    [searchParams, profile]
  )

  const [city, setCity] = useState(resolved.citySlug)
  const [area, setArea] = useState(resolved.area ?? '')
  const [specialty, setSpecialty] = useState(searchParams.get('specialty') ?? '')
  const [hospital, setHospital] = useState('')

  const cityHospitals = FAMOUS_HOSPITALS[city] ?? []

  useEffect(() => {
    setCity(resolved.citySlug)
    if (resolved.area && !searchParams.get('area')) {
      setArea(resolved.area)
    }
  }, [resolved.citySlug, resolved.area, searchParams])

  useEffect(() => {
    if (useNearMe && !location && !locating) requestLocation()
  }, [useNearMe, location, locating, requestLocation])

  useEffect(() => {
    async function loadDoctors() {
      setLoading(true)
      try {
        const response = await discoverLiveCare({
          city,
          cityLabel: resolved.cityLabel,
          area: area.trim() || undefined,
          specialty: specialty || undefined,
          hospital: hospital || undefined,
          latitude: useNearMe && location ? location.lat : undefined,
          longitude: useNearMe && location ? location.lng : undefined,
          radiusKm: 25,
        })
        setDoctors(response.results)
        setMeta(response.meta)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load facilities')
      } finally {
        setLoading(false)
      }
    }

    if (useNearMe && !location) {
      if (!locating && locationError) setLoading(false)
      return
    }

    loadDoctors()
    setSearchParams({
      ...(city && !useNearMe && { city }),
      ...(area.trim() && !useNearMe && { area: area.trim() }),
      ...(specialty && { specialty }),
      ...(useNearMe && { nearMe: '1' }),
    })
  }, [city, area, specialty, hospital, useNearMe, location, locating, locationError, setSearchParams, resolved.cityLabel])

  const toggleNearMe = () => {
    if (useNearMe) {
      setUseNearMe(false)
      clearLocation()
    } else {
      setUseNearMe(true)
      requestLocation()
    }
  }

  const searchModeLabel = useNearMe
    ? t('doctors.searchModeGpsLive', { city: resolved.cityLabel })
    : t('doctors.searchModeCityLive', { city: resolved.cityLabel })

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold md:text-3xl">{t('doctors.title')}</h1>
        <p className="text-muted-foreground">{t('doctors.subtitleLive')}</p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-primary">
          <MapPin className="size-3.5" />
          {searchModeLabel}
        </p>
        {meta && !loading && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
              <Globe className="size-3" />
              {t('doctors.facilityCount', { count: meta.facility_count })}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1">
              {t('doctors.resultsWithin', { km: meta.radius_km })}
            </span>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
              {t('doctors.liveDataSource')}
            </span>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={city} onValueChange={(v) => { setCity(v ?? 'lahore'); setHospital('') }} disabled={useNearMe}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            {PAKISTAN_CITIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          className="w-40"
          placeholder={t('doctors.areaPlaceholder')}
          value={area}
          onChange={(e) => setArea(e.target.value)}
          disabled={useNearMe}
        />

        {cityHospitals.length > 0 && (
          <Select value={hospital} onValueChange={(v) => setHospital(v ?? '')}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder={t('doctors.anyHospital')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('doctors.anyHospital')}</SelectItem>
              {cityHospitals.map((h) => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={specialty} onValueChange={(v) => setSpecialty(v ?? '')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('doctors.allSpecialties')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('doctors.allSpecialties')}</SelectItem>
            {MEDICAL_SPECIALTIES.map((s) => (
              <SelectItem key={s.slug} value={s.slug}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant={useNearMe ? 'default' : 'outline'} size="sm" className="gap-1.5" onClick={toggleNearMe} disabled={locating}>
          <Navigation className="size-3.5" />
          {locating ? t('doctors.locating') : useNearMe ? t('doctors.nearMeOn') : t('doctors.nearMe')}
        </Button>

        <div className="ms-auto flex rounded-lg border p-1">
          <Button size="sm" variant={viewMode === 'list' ? 'default' : 'ghost'} className="gap-1" onClick={() => setViewMode('list')}>
            <List className="size-3.5" />{t('doctors.list')}
          </Button>
          <Button size="sm" variant={viewMode === 'map' ? 'default' : 'ghost'} className="gap-1" onClick={() => setViewMode('map')}>
            <Map className="size-3.5" />{t('doctors.map')}
          </Button>
        </div>
      </div>

      {useNearMe && locationError && <p className="mb-4 text-sm text-destructive">{locationError}</p>}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : doctors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>{t('doctors.noResultsInCity', { city: resolved.cityLabel })}</p>
            <p className="mt-2 text-sm">{t('doctors.noResultsLiveHint')}</p>
          </CardContent>
        </Card>
      ) : viewMode === 'map' ? (
        <DoctorsMap doctors={doctors} city={city} userLocation={useNearMe ? location : null} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {doctors.map((doctor) => (
            <DiscoveryDoctorCard
              key={doctor.id}
              doctor={doctor}
              userLocation={useNearMe ? location : null}
            />
          ))}
        </div>
      )}

      {!loading && doctors.length > 0 && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t('doctors.osmAttribution')}
        </p>
      )}
    </div>
  )
}
