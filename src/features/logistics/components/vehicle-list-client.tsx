'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VehicleTable } from './vehicle-table'
import { toggleVehicleStatus } from '@/features/logistics/actions/vehicle-actions'
import type { Vehicle } from '@/lib/db/schema/vehicles'

interface VehicleListClientProps {
  initialData: Vehicle[]
  total: number
  page: number
  search: string
}

export function VehicleListClient({
  initialData,
  total,
  page,
  search,
}: VehicleListClientProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  const updateParam = (key: string, value: string | null) => {
    const sp = new URLSearchParams(params?.toString() ?? '')
    if (value) sp.set(key, value)
    else sp.delete(key)
    if (key !== 'page') sp.delete('page')
    startTransition(() => {
      router.replace(`/vehiculos?${sp.toString()}`, { scroll: false })
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          defaultValue={search}
          placeholder="Buscar por placa o modelo…"
          onChange={(e) => updateParam('search', e.target.value || null)}
          className="max-w-xs"
        />
        <Link href="/vehiculos/nuevo">
          <Button>+ Nuevo vehículo</Button>
        </Link>
      </div>

      <VehicleTable
        data={initialData}
        total={total}
        page={page}
        onPageChange={(p) => updateParam('page', String(p))}
        onToggleStatus={async (v) => {
          await toggleVehicleStatus(v.id)
          router.refresh()
        }}
      />
    </div>
  )
}
