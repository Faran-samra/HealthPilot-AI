import { useCallback, useState } from 'react'

interface GeolocationState {
  lat: number
  lng: number
}

export function useGeolocation() {
  const [location, setLocation] = useState<GeolocationState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported on this device')
      return
    }

    setLoading(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setLoading(false)
      },
      (err) => {
        setError(
          err.code === 1
            ? 'Location permission denied. Enable location access or pick a city manually.'
            : 'Unable to get your location. Try again or search by city.'
        )
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  }, [])

  const clearLocation = useCallback(() => {
    setLocation(null)
    setError(null)
  }, [])

  return { location, loading, error, requestLocation, clearLocation }
}
