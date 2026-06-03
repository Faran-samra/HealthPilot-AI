import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
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
import { DirectoryDoctorGridSkeleton } from '@/components/doctors/DirectoryDoctorCardSkeleton'
import { findNearbyDoctors, getCitiesWithDoctorCounts } from '@/services/doctorService'
import { useAuthStore } from '@/store/authStore'
import { useGeolocation } from '@/hooks/useGeolocation'
import { FEE_RANGES, MEDICAL_SPECIALTIES, PAKISTAN_CITIES } from '@/utils/constants'
import {
  buildHealthcareFacilitiesUrl,
  getCityLabel,
  nearestCitySlug,
  resolveSearchLocation,
} from '@/utils/locationUtils'
import {
  clearDirectoryListScroll,
  getStoredDoctorsListSearch,
  persistDoctorsListSearch,
  readDirectoryListScroll,
} from '@/utils/doctorsListSearch'
import { useDoctorsDirectoryStore } from '@/store/doctorsDirectoryStore'
import { readCachedCityCounts, writeCachedCityCounts } from '@/utils/cityCountsCache'
import { filterDirectoryDoctors } from '@/utils/directoryListClientFilter'
import {
  cityDirectoryCacheKey,
  isCityOnlyDirectorySearch,
  prefetchCitiesIdle,
  prefetchCityDirectory,
  PREFETCH_CITY_SLUGS,
} from '@/utils/directoryPrefetch'
import { cn } from '@/lib/utils'
import { toDirectoryDoctor, type DirectoryDoctor } from '@/types/doctorDirectory'

function filtersFromParams(searchParams: URLSearchParams) {
  return {
    specialty: searchParams.get('specialty') ?? 'all',
    name: searchParams.get('name') ?? '',
    maxFee: searchParams.get('maxFee') ? Number(searchParams.get('maxFee')) : undefined,
    minFee: searchParams.get('minFee') ? Number(searchParams.get('minFee')) : undefined,
    femaleOnly: searchParams.get('female') === '1',
    maleOnly: searchParams.get('male') === '1',
    language: searchParams.get('language') ?? '',
    useNearMe: searchParams.get('nearMe') === '1',
    area: searchParams.get('area') ?? '',
  }
}

export default function FindDoctorsDirectory() {
  const { t } = useTranslation()
  const { profile } = useAuthStore()
  const { location, loading: locating, error: locationError, requestLocation, clearLocation } =
    useGeolocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const peekDirectoryCache = useDoctorsDirectoryStore((s) => s.peek)
  const putDirectoryCache = useDoctorsDirectoryStore((s) => s.put)
  const [doctors, setDoctors] = useState<DirectoryDoctor[]>(() => {
    const key = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : ''
    ).toString() || getStoredDoctorsListSearch()
    if (!key) return []
    return useDoctorsDirectoryStore.getState().peek(key) ?? []
  })
  const [loading, setLoading] = useState(() => {
    const key =
      new URLSearchParams(
        typeof window !== 'undefined' ? window.location.search : ''
      ).toString() || getStoredDoctorsListSearch()
    if (!key) return true
    return (useDoctorsDirectoryStore.getState().peek(key) ?? []).length === 0
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [cityCounts, setCityCounts] = useState<Map<string, number>>(
    () => readCachedCityCounts() ?? new Map()
  )

  const resolved = useMemo(
    () => resolveSearchLocation(searchParams, profile),
    [searchParams, profile]
  )

  const initialFilters = filtersFromParams(searchParams)
  const [city, setCity] = useState(resolved.citySlug)
  const [area, setArea] = useState(resolved.area ?? initialFilters.area)
  const [specialty, setSpecialty] = useState(initialFilters.specialty)
  const [name, setName] = useState(initialFilters.name)
  const [debouncedName, setDebouncedName] = useState(initialFilters.name)
  const [hospital, setHospital] = useState('')
  const [maxFee, setMaxFee] = useState<number | undefined>(initialFilters.maxFee)
  const [minFee, setMinFee] = useState<number | undefined>(initialFilters.minFee)
  const [femaleOnly, setFemaleOnly] = useState(initialFilters.femaleOnly)
  const [maleOnly, setMaleOnly] = useState(initialFilters.maleOnly)
  const [language, setLanguage] = useState(initialFilters.language)
  const [useNearMe, setUseNearMe] = useState(initialFilters.useNearMe)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedName(name), 300)
    return () => window.clearTimeout(timer)
  }, [name])

  const listSearchQuery = useMemo(() => {
    const p = new URLSearchParams()
    if (city) p.set('city', city)
    if (area.trim()) p.set('area', area.trim())
    if (specialty !== 'all') p.set('specialty', specialty)
    if (debouncedName.trim()) p.set('name', debouncedName.trim())
    if (useNearMe) p.set('nearMe', '1')
    if (maxFee) p.set('maxFee', String(maxFee))
    if (minFee) p.set('minFee', String(minFee))
    if (femaleOnly) p.set('female', '1')
    if (maleOnly) p.set('male', '1')
    if (language.trim()) p.set('language', language.trim())
    return p.toString()
  }, [city, area, specialty, debouncedName, useNearMe, maxFee, minFee, femaleOnly, maleOnly, language])

  const searchCacheKey = useMemo(() => {
    const p = new URLSearchParams(listSearchQuery)
    if (hospital.trim()) p.set('hospital', hospital.trim())
    return p.toString()
  }, [listSearchQuery, hospital])

  const listFilters = useMemo(
    () => ({
      specialty: specialty !== 'all' ? specialty : undefined,
      name: debouncedName,
      area,
      hospital,
      maxFee,
      minFee,
      femaleOnly,
      maleOnly,
      language,
    }),
    [specialty, debouncedName, area, hospital, maxFee, minFee, femaleOnly, maleOnly, language]
  )

  const usingStaleCityList = useMemo(() => {
    if (useNearMe || !city) return false
    if (peekDirectoryCache(searchCacheKey)) return false
    return Boolean(peekDirectoryCache(cityDirectoryCacheKey(city)))
  }, [useNearMe, city, searchCacheKey, peekDirectoryCache])

  const visibleDoctors = useMemo(() => {
    if (usingStaleCityList && !isCityOnlyDirectorySearch(searchCacheKey, city)) {
      return filterDirectoryDoctors(doctors, listFilters)
    }
    return doctors
  }, [usingStaleCityList, searchCacheKey, city, doctors, listFilters])

  useEffect(() => {
    prefetchCitiesIdle(PREFETCH_CITY_SLUGS)
  }, [])

  useEffect(() => {
    if (!useNearMe && city) prefetchCityDirectory(city)
  }, [city, useNearMe])

  const citiesForSelect = useMemo(() => {
    const withDocs = PAKISTAN_CITIES.filter((c) => (cityCounts.get(c.value) ?? 0) > 0).sort(
      (a, b) => (cityCounts.get(b.value) ?? 0) - (cityCounts.get(a.value) ?? 0)
    )
    if (city && !withDocs.some((c) => c.value === city)) {
      const meta = PAKISTAN_CITIES.find((c) => c.value === city)
      if (meta) return [meta, ...withDocs]
    }
    if (withDocs.length > 0) return withDocs
    return PAKISTAN_CITIES.filter((c) =>
      ['lahore', 'karachi', 'islamabad', 'rawalpindi', 'faisalabad', 'multan', 'peshawar'].includes(
        c.value
      )
    )
  }, [cityCounts, city])

  useEffect(() => {
    if (cityCounts.size > 0) return
    let cancelled = false
    getCitiesWithDoctorCounts()
      .then((counts) => {
        if (cancelled) return
        setCityCounts(counts)
        writeCachedCityCounts(counts)
      })
      .catch(() => {
        if (!cancelled) toast.error(t('directory.loadError'))
      })
    return () => {
      cancelled = true
    }
  }, [cityCounts.size, t])

  useEffect(() => {
    const hasListFilters = ['city', 'nearMe', 'specialty', 'name', 'area'].some((k) =>
      searchParams.has(k)
    )
    if (!hasListFilters) {
      const stored = getStoredDoctorsListSearch()
      if (stored) {
        setSearchParams(new URLSearchParams(stored), { replace: true })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once on mount
  }, [])

  useEffect(() => {
    const r = resolveSearchLocation(searchParams, profile)
    const f = filtersFromParams(searchParams)
    setCity(r.citySlug)
    setArea(r.area ?? f.area)
    setSpecialty(f.specialty)
    setName(f.name)
    setMaxFee(f.maxFee)
    setMinFee(f.minFee)
    setFemaleOnly(f.femaleOnly)
    setMaleOnly(f.maleOnly)
    setLanguage(f.language)
    setUseNearMe(f.useNearMe)
  }, [searchParams, profile])

  useEffect(() => {
    if (useNearMe && !location && !locating) requestLocation()
  }, [useNearMe, location, locating, requestLocation])

  useEffect(() => {
    if (useNearMe && location) {
      setCity(nearestCitySlug(location.lat, location.lng))
    }
  }, [useNearMe, location])

  const syncUrl = useCallback(() => {
    const next = new URLSearchParams()
    if (city) next.set('city', city)
    if (area.trim()) next.set('area', area.trim())
    if (specialty !== 'all') next.set('specialty', specialty)
    if (debouncedName.trim()) next.set('name', debouncedName.trim())
    if (useNearMe) next.set('nearMe', '1')
    if (maxFee) next.set('maxFee', String(maxFee))
    if (minFee) next.set('minFee', String(minFee))
    if (femaleOnly) next.set('female', '1')
    if (maleOnly) next.set('male', '1')
    if (language.trim()) next.set('language', language.trim())
    setSearchParams(next, { replace: true })
    persistDoctorsListSearch(next)
  }, [
    city,
    area,
    specialty,
    debouncedName,
    useNearMe,
    maxFee,
    minFee,
    femaleOnly,
    maleOnly,
    language,
    setSearchParams,
  ])

  useEffect(() => {
    syncUrl()
  }, [syncUrl])

  useLayoutEffect(() => {
    if (loading || visibleDoctors.length === 0) return
    const y = readDirectoryListScroll()
    if (y == null) return
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, left: 0 })
      clearDirectoryListScroll()
    })
  }, [loading, visibleDoctors.length, searchCacheKey])

  useLayoutEffect(() => {
    const exact = peekDirectoryCache(searchCacheKey)
    if (exact) {
      setDoctors(exact)
      setLoading(false)
      setIsRefreshing(false)
      return
    }

    if (!useNearMe && city) {
      const base = peekDirectoryCache(cityDirectoryCacheKey(city))
      if (base) {
        setDoctors(base)
        setLoading(false)
        setIsRefreshing(true)
        return
      }
    }

    if (doctors.length === 0) setLoading(true)
  }, [searchCacheKey, city, useNearMe, peekDirectoryCache, doctors.length])

  useEffect(() => {
    let cancelled = false
    const exact = peekDirectoryCache(searchCacheKey)
    if (exact) {
      setDoctors(exact)
      setLoading(false)
      setIsRefreshing(false)
      return
    }

    if (useNearMe && !location) {
      if (!locating && locationError) setLoading(false)
      return
    }

    const staleCityKey = !useNearMe && city ? cityDirectoryCacheKey(city) : null
    const hasStaleList = Boolean(staleCityKey && peekDirectoryCache(staleCityKey))
    if (hasStaleList && staleCityKey) {
      const base = peekDirectoryCache(staleCityKey)!
      setDoctors(base)
      setLoading(false)
      setIsRefreshing(true)
    } else {
      setLoading(doctors.length === 0)
      setIsRefreshing(false)
    }

    findNearbyDoctors({
      city,
      area: area.trim() || undefined,
      specialty: specialty !== 'all' ? specialty : undefined,
      hospital: hospital.trim() || undefined,
      name: debouncedName.trim() || undefined,
      latitude: useNearMe && location ? location.lat : undefined,
      longitude: useNearMe && location ? location.lng : undefined,
      maxFee,
      minFee,
      femaleOnly,
      maleOnly,
      language: language.trim() || undefined,
    })
      .then((results) => {
        if (cancelled) return
        const mapped = results.map((r) => toDirectoryDoctor(r))
        setDoctors(mapped)
        putDirectoryCache(searchCacheKey, mapped)
        if (!useNearMe && city && isCityOnlyDirectorySearch(searchCacheKey, city)) {
          putDirectoryCache(cityDirectoryCacheKey(city), mapped)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : t('directory.loadError'))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setIsRefreshing(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    searchCacheKey,
    city,
    area,
    specialty,
    debouncedName,
    hospital,
    maxFee,
    minFee,
    femaleOnly,
    maleOnly,
    language,
    useNearMe,
    location,
    locating,
    locationError,
    peekDirectoryCache,
    putDirectoryCache,
    t,
  ])

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
        {!useNearMe && city && (
          <p className="mt-2 text-sm text-muted-foreground">
            {t('directory.showingInCity', { city: getCityLabel(city) })}
          </p>
        )}
        <Card className="mt-4 border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="size-4" />
              {t('directory.needFacility')}
            </span>
            <Link to={facilitiesUrl}>
              <Button size="sm" variant="outline">
                {t('nav.healthcareFacilities')}
              </Button>
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
        <Select
          value={city}
          onValueChange={(v) => {
            const next = v ?? citiesForSelect[0]?.value ?? 'lahore'
            prefetchCityDirectory(next)
            setCity(next)
          }}
          disabled={useNearMe}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('directory.city')} />
          </SelectTrigger>
          <SelectContent>
            {citiesForSelect.map((c) => (
              <SelectItem
                key={c.value}
                value={c.value}
                onPointerEnter={() => prefetchCityDirectory(c.value)}
              >
                {c.label}
              </SelectItem>
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
              <SelectItem key={s.slug} value={s.slug}>
                {s.label}
              </SelectItem>
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
              <SelectItem key={f.label} value={String(f.max)}>
                {f.label}
              </SelectItem>
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

      {loading && visibleDoctors.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <DirectoryDoctorGridSkeleton count={6} />
        </div>
      ) : visibleDoctors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t('directory.noResults')}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t('directory.noResultsHint')}</p>
            {citiesForSelect.length > 1 && (
              <p className="mt-3 text-sm text-muted-foreground">
                {t('directory.tryAnotherCity', { city: citiesForSelect[0]?.label ?? '' })}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {useNearMe && (
            <p className="mb-3 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {t('directory.nearMeDistanceNote', { city: getCityLabel(city) })}
            </p>
          )}
          <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {t('directory.resultCount', { count: visibleDoctors.length })}
            {isRefreshing && (
              <span className="text-xs text-primary">{t('directory.updatingList')}</span>
            )}
            {loading && !isRefreshing && (
              <span className="size-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            )}
          </p>
          <div className="relative">
            {isRefreshing && (
              <div
                className="pointer-events-none absolute inset-0 z-10 rounded-lg bg-background/30"
                aria-hidden
              />
            )}
            <div
              className={cn(
                'grid gap-4 md:grid-cols-2 transition-opacity duration-200',
                isRefreshing && 'opacity-75'
              )}
            >
              {visibleDoctors.map((d) => (
                <DirectoryDoctorCard
                  key={d.id}
                  doctor={d}
                  showDistance={useNearMe}
                  listSearchQuery={searchCacheKey}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
