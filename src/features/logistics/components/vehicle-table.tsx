'use client'

import { Pencil, Power, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { IconButton } from '@/components/ui/icon-button'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { Vehicle } from '@/lib/db/schema/vehicles'

interface VehicleTableProps {
  data: Vehicle[]
  total: number
  page: number
  onPageChange: (page: number) => void
  onToggleStatus?: (vehicle: Vehicle) => void
}

const PAGE_SIZE = 20

export function VehicleTable({
  data,
  total,
  page,
  onPageChange,
  onToggleStatus,
}: VehicleTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (data.length === 0) {
    return (
      <div className="rounded-md border border-border p-8 text-center text-sm text-muted-foreground">
        No hay vehículos registrados
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Placa</th>
              <th className="px-3 py-2 font-medium">Móvil</th>
              <th className="px-3 py-2 font-medium">Modelo</th>
              <th className="px-3 py-2 font-medium">Año</th>
              <th className="px-3 py-2 font-medium">Capacidad</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map((v) => (
              <tr key={v.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono">{v.plate}</td>
                <td className="px-3 py-2">{v.mobileNumber ?? '—'}</td>
                <td className="px-3 py-2">{v.model ?? '—'}</td>
                <td className="px-3 py-2">{v.year ?? '—'}</td>
                <td className="px-3 py-2">{v.capacity ?? '—'}</td>
                <td className="px-3 py-2">
                  <StatusBadge isActive={v.isActive} />
                </td>
                <td className="px-3 py-2 text-right">
                  <TooltipProvider>
                    <div className="flex items-center justify-end gap-0.5">
                      <IconButton label="Editar" href={`/vehiculos/${v.id}/editar`}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      {onToggleStatus && (
                        <IconButton
                          label={v.isActive ? 'Desactivar' : 'Activar'}
                          onClick={() => onToggleStatus(v)}
                          className={
                            v.isActive
                              ? 'hover:bg-destructive/10 hover:text-destructive'
                              : 'hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/30 dark:hover:text-green-400'
                          }
                        >
                          {v.isActive ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </IconButton>
                      )}
                    </div>
                  </TooltipProvider>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPages} · {total} vehículos
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Página anterior"
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Página siguiente"
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
