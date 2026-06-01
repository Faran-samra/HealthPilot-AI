import { useEffect } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { DiscoveryDoctor } from '@/types/discovery'
import { getCityCenter, type MapPoint } from '@/utils/mapUtils'
import 'leaflet/dist/leaflet.css'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const userIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 2px #2563eb;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

interface DoctorsMapProps {
  doctors: DiscoveryDoctor[]
  city?: string
  userLocation?: MapPoint | null
  className?: string
}

function FitBounds({ doctors, userLocation, city }: DoctorsMapProps) {
  const map = useMap()

  useEffect(() => {
    const points: MapPoint[] = doctors.map((d) => ({ lat: d.latitude, lng: d.longitude }))
    if (userLocation) points.push(userLocation)

    if (points.length === 0) {
      const center = getCityCenter(city ?? 'lahore')
      map.setView([center.lat, center.lng], 12)
      return
    }

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14)
      return
    }

    map.fitBounds(
      points.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [40, 40], maxZoom: 14 }
    )
  }, [map, doctors, userLocation, city])

  return null
}

export function DoctorsMap({ doctors, city, userLocation, className }: DoctorsMapProps) {
  const { t } = useTranslation()
  const center = userLocation ?? getCityCenter(city ?? 'lahore')

  return (
    <div className={className}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={12}
        scrollWheelZoom
        className="h-[420px] w-full rounded-xl border z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds doctors={doctors} userLocation={userLocation} city={city} />

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup>{t('doctors.youAreHere')}</Popup>
          </Marker>
        )}

        {doctors.map((doctor) => (
          <Marker
            key={doctor.id}
            position={[doctor.latitude, doctor.longitude]}
            icon={defaultIcon}
          >
            <Popup>
              <div className="min-w-[180px] space-y-2">
                <p className="font-semibold">{doctor.full_name}</p>
                <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                {doctor.hospital_name && <p className="text-xs">{doctor.hospital_name}</p>}
                <p className="text-xs font-medium text-primary">
                  {doctor.distance_km.toFixed(1)} km away
                </p>
                <Link to={`/places/${doctor.id}`} state={{ place: doctor }}>
                  <Button size="sm" variant="secondary" className="w-full">{t('doctors.viewDetails')}</Button>
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <p className="mt-2 text-xs text-muted-foreground">
        {t('doctors.mapLegendLive')}
      </p>
    </div>
  )
}
