import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, Navigation, Search, Stethoscope } from 'lucide-react'
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
import { DirectoryDoctorCard } from '@/components/doctors/DirectoryDoctorCard'
import { findNearbyDoctors } from '@/services/doctorService'
import { useAuthStore } from '@/store/authStore'
import { useGeolocation } from '@/hooks/useGeolocation'
import { FEE_RANGES, MEDICAL_SPECIALTIES, PAKISTAN_CITIES } from '@/utils/constants'
import {
  buildHealthcareFacilitiesUrl,
  getCityLabel,
  nearestCitySlug,
  resolveSearchLocation,
} from '@/utils/locationUtils'
import { toDirectoryDoctor, type DirectoryDoctor } from '@/types/doctorDirectory'

export default function FindDoctorsDirectory() {
  const { t } = useTranslation()
  const { profile } = useAuthStore()
  const { location, loading: locating, error: locationError, requestLocation, clearLocation } =
    useGeolocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [doctors, setDoctors] = useState<DirectoryDoctor[]>([])
  const [loading, setLoading] = useState(true)
  const [useNearMe, setUseNearMe] = useState(searchParams.get('nearMe') === '1')

  const resolved = useMemo(
    () => resolveSearchLocation(searchParams, profile),
    [searchParams, profile]
  )

  const [city, setCity] = useState(resolved.citySlug)
  const [area, setArea] = useState(resolved.area ?? searchParams.get('area') ?? '')
  const [specialty, setSpecialty] = useState(searchParams.get('specialty') ?? 'all')
  const [name, setName] = useState(searchParams.get('name') ?? '')
  const [hospital, setHospital] = useState('')
  const [maxFee, setMaxFee] = useState<number | undefined>(
    searchParams.get('maxFee') ? Number(searchParams.get('maxFee')) : undefined
  )
  const [femaleOnly, setFemaleOnly] = useState(searchParams.get('female') === '1')
  const [maleOnly, setMaleOnly] = useState(searchParams.get('male') === '1')
  const [language, setLanguage] = useState(searchParams.get('language') ?? '')
  const [minFee, setMinFee] = useState<number | undefined>(
    searchParams.get('minFee') ? Number(searchParams.get('minFee')) : undefined
  )

  useEffect(() => {
    if (useNearMe && !location && !locating) requestLocation()
  }, [useNearMe, location, locating, requestLocation])

  useEffect(() => {
    if (useNearMe && location) {
      setCity(nearestCitySlug(location.lat, location.lng))
    }
  }, [useNearMe, location])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const results = await findNearbyDoctors({
          city,
          area: area.trim() || undefined,
          specialty: specialty !== 'all' ? specialty : undefined,
          hospital: hospital || undefined,
          name: name.trim() || undefined,
          latitude: useNearMe && location ? location.lat : undefined,
          longitude: useNearMe && location ? location.lng : undefined,
          maxFee,
          minFee,
          femaleOnly,
          maleOnly,
          language: language.trim() || undefined,
        })
        setDoctors(results.map((r) => toDirectoryDoctor(r)))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('directory.loadError'))
      } finally {
        setLoading(false)
      }
    }

    if (useNearMe && !location) {
      if (!locating && locationError) setLoading(false)
      return
    }
    load()
    setSearchParams({
      ...(city && !useNearMe && { city }),
      ...(area.trim() && { area: area.trim() }),
      ...(specialty !== 'all' && { specialty }),
      ...(name.trim() && { name: name.trim() }),
      ...(useNearMe && { nearMe: '1' }),
      ...(maxFee && { maxFee: String(maxFee) }),
      ...(minFee && { minFee: String(minFee) }),
      ...(femaleOnly && { female: '1' }),
      ...(maleOnly && { male: '1' }),
      ...(language.trim() && { language: language.trim() }),
    })
  }, [city, area, specialty, name, hospital, maxFee, minFee, femaleOnly, maleOnly, language, useNearMe, location, locating, locationError, setSearchParams, t])

  const facilitiesUrl = buildHealthcareFacilitiesUrl({
    city,
    specialty: specialty || undefined,
    nearMe: useNearMe,
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Stethoscope className="size-3.5" />
          {t('directory.badge')}
        </p>
        <h1 className="text-2xl font-bold md:text-3xl">{t('directory.title')}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t('directory.subtitle')}</p>
        <Card className="mt-4 border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="size-4" />
              {t('directory.needFacility')}
            </span>
            <Link to={facilitiesUrl}>
              <Button size="sm" variant="outline">{t('nav.healthcareFacilities')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t('directory.searchName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Select value={city} onValueChange={(v) => setCity(v ?? 'lahore')} disabled={useNearMe}>
          <SelectTrigger>
            <SelectValue placeholder={t('directory.city')} />
          </SelectTrigger>
          <SelectContent>
            {PAKISTAN_CITIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder={t('directory.area')}
          value={area}
          onChange={(e) => setArea(e.target.value)}
          disabled={useNearMe}
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Select value={specialty} onValueChange={(v) => setSpecialty(v ?? 'all')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('directory.allSpecialties')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('directory.allSpecialties')}</SelectItem>
            {MEDICAL_SPECIALTIES.map((s) => (
              <SelectItem key={s.slug} value={s.slug}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-48"
          placeholder={t('directory.hospital')}
          value={hospital}
          onChange={(e) => setHospital(e.target.value)}
        />
        <Select
          value={maxFee ? String(maxFee) : ''}
          onValueChange={(v) => setMaxFee(v ? Number(v) : undefined)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('directory.maxFee')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('directory.anyFee')}</SelectItem>
            {FEE_RANGES.filter((f): f is (typeof FEE_RANGES)[number] & { max: number } => 'max' in f).map((f) => (
              <SelectItem key={f.label} value={String(f.max)}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={minFee ? String(minFee) : ''}
          onValueChange={(v) => setMinFee(v ? Number(v) : undefined)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t('directory.minFee')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('directory.anyFee')}</SelectItem>
            <SelectItem value="500">500+</SelectItem>
            <SelectItem value="1500">1,500+</SelectItem>
            <SelectItem value="3000">3,000+</SelectItem>
          </SelectContent>
        </Select>
        <Select value={language} onValueChange={(v) => setLanguage(v ?? '')}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t('directory.anyLanguage')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('directory.anyLanguage')}</SelectItem>
            <SelectItem value="Urdu">Urdu</SelectItem>
            <SelectItem value="English">English</SelectItem>
            <SelectItem value="Punjabi">Punjabi</SelectItem>
            <SelectItem value="Sindhi">Sindhi</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={femaleOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setFemaleOnly((v) => !v)
            if (!femaleOnly) setMaleOnly(false)
          }}
        >
          {t('common.femaleDoctor')}
        </Button>
        <Button
          variant={maleOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setMaleOnly((v) => !v)
            if (!maleOnly) setFemaleOnly(false)
          }}
        >
          {t('common.maleDoctor')}
        </Button>
        <Button
          variant={useNearMe ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5"
          onClick={() => {
            if (useNearMe) {
              setUseNearMe(false)
              clearLocation()
            } else {
              setUseNearMe(true)
              requestLocation()
            }
          }}
          disabled={locating}
        >
          <Navigation className="size-3.5" />
          {locating ? t('directory.locating') : t('directory.nearMe')}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : doctors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t('directory.noResults')}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t('directory.noResultsHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {useNearMe && (
            <p className="mb-3 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {t('directory.nearMeDistanceNote', { city: getCityLabel(city) })}
            </p>
          )}
          <p className="mb-4 text-sm text-muted-foreground">
            {t('directory.resultCount', { count: doctors.length })}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {doctors.map((d) => (
              <DirectoryDoctorCard key={d.id} doctor={d} showDistance={useNearMe} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
