'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, ExternalLink, AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ensureLocationGeocoded } from '@/features/campaigns/actions/geocode-actions'

// Fix de íconos de marcador con bundlers: Leaflet referencia rutas relativas
// que no resuelven; usamos los assets servidos por unpkg.
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

interface CampaignMapProps {
  locationId: string
  initialLat: number | null
  initialLng: number | null
  label: string
  address: string
}

type Status = 'ready' | 'loading' | 'not-found'

export default function CampaignMap({
  locationId,
  initialLat,
  initialLng,
  label,
  address,
}: CampaignMapProps) {
  const hasInitial = initialLat != null && initialLng != null
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    hasInitial ? { lat: initialLat as number, lng: initialLng as number } : null,
  )
  const [status, setStatus] = useState<Status>(hasInitial ? 'ready' : 'loading')

  useEffect(() => {
    if (hasInitial) return
    let active = true
    ensureLocationGeocoded(locationId)
      .then((result) => {
        if (!active) return
        if (result) {
          setCoords(result)
          setStatus('ready')
        } else {
          setStatus('not-found')
        }
      })
      .catch(() => active && setStatus('not-found'))
    return () => {
      active = false
    }
  }, [hasInitial, locationId])

  if (status === 'loading') {
    return <Skeleton className="h-72 w-full rounded-md" />
  }

  if (status === 'not-found' || !coords) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border text-muted-foreground">
        <AlertCircle className="size-6" />
        <p className="text-sm">No se pudo ubicar la dirección en el mapa.</p>
        <p className="text-xs">{address}</p>
      </div>
    )
  }

  const osmUrl = `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=17/${coords.lat}/${coords.lng}`

  return (
    <div className="space-y-2">
      <div className="relative isolate z-0 h-72 w-full overflow-hidden rounded-md border border-border">
        <MapContainer
          center={[coords.lat, coords.lng]}
          zoom={16}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Claro (Carto)">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Calles (OSM)">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satélite (Esri)">
              <TileLayer
                attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            </LayersControl.BaseLayer>
          </LayersControl>
          <Marker position={[coords.lat, coords.lng]} icon={markerIcon}>
            <Popup>
              <strong>{label}</strong>
              <br />
              {address}
            </Popup>
          </Marker>
        </MapContainer>
      </div>
      <a
        href={osmUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <MapPin className="size-3.5" />
        Abrir en OpenStreetMap
        <ExternalLink className="size-3" />
      </a>
    </div>
  )
}
