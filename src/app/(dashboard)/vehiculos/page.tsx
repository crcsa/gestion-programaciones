import { redirect } from 'next/navigation'
import { getVehicleList } from '@/features/logistics/actions/vehicle-actions'
import { VehicleListClient } from '@/features/logistics/components/vehicle-list-client'
import type { Vehicle } from '@/lib/db/schema/vehicles'

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function VehiculosPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {}
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page
  const searchRaw = Array.isArray(sp.search) ? sp.search[0] : sp.search
  const page = Math.max(1, Number(pageRaw) || 1)
  const search = (searchRaw ?? '').trim()

  let result: { data: Vehicle[]; total: number }
  try {
    result = await getVehicleList({ page, search: search || undefined })
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) {
      redirect('/')
    }
    throw error
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vehículos</h1>
        <p className="text-sm text-muted-foreground">
          Gestión de vehículos del área de logística.
        </p>
      </div>
      <VehicleListClient
        initialData={result.data}
        total={result.total}
        page={page}
        search={search}
      />
    </div>
  )
}
