'use client'

import dynamic from 'next/dynamic'
import { MapPin } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { CampaignLocation } from '@/features/campaigns/actions/campaign-actions'

// El mapa (Leaflet) es client-only: requiere `window`, por eso ssr:false.
const CampaignMap = dynamic(() => import('./campaign-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full rounded-md" />,
})

interface CampaignLocationCardProps {
  location: CampaignLocation | null
  companyName: string | null
}

export function CampaignLocationCard({ location, companyName }: CampaignLocationCardProps) {
  // Sin ubicación con dirección no hay nada que mapear → no renderiza la tarjeta.
  if (!location || !location.address) return null

  return (
    <section className="rounded-lg border border-border p-5">
      <header className="mb-4 flex items-center gap-2">
        <MapPin className="size-5 text-muted-foreground" />
        <h2 className="text-base font-semibold">Ubicación</h2>
      </header>
      <div className="mb-3 space-y-0.5 text-sm">
        <p>{location.address}</p>
        <p className="text-muted-foreground">
          {location.municipality}
          {location.referencePoint ? ` — ${location.referencePoint}` : ''}
        </p>
      </div>
      <CampaignMap
        locationId={location.id}
        initialLat={location.latitude}
        initialLng={location.longitude}
        label={companyName ?? location.address}
        address={location.address}
      />
    </section>
  )
}
