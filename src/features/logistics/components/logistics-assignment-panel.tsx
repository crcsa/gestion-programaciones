'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Truck, UserSquare2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  assignVehicle,
  removeVehicleAssignment,
  setDriver,
} from '@/features/logistics/actions/campaign-vehicle-actions'
import type {
  AssignedVehicleRow,
  AvailableDriverRow,
  AvailableVehicleRow,
} from '@/features/logistics/actions/campaign-vehicle-actions'

interface LogisticsAssignmentPanelProps {
  campaignId: string
  assigned: AssignedVehicleRow[]
  availableVehicles: AvailableVehicleRow[]
  availableDrivers: AvailableDriverRow[]
  canEdit: boolean
}

export function LogisticsAssignmentPanel({
  campaignId,
  assigned,
  availableVehicles,
  availableDrivers,
  canEdit,
}: LogisticsAssignmentPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selectedVehicle, setSelectedVehicle] = useState<string>('')
  const [selectedDriver, setSelectedDriver] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const onAssign = () => {
    if (!selectedVehicle) return
    setError(null)
    startTransition(async () => {
      try {
        await assignVehicle({
          campaignId,
          vehicleId: selectedVehicle,
          driverStaffId: selectedDriver || undefined,
        })
        setSelectedVehicle('')
        setSelectedDriver('')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al asignar vehículo')
      }
    })
  }

  const onRemove = (id: string) => {
    startTransition(async () => {
      try {
        await removeVehicleAssignment(id)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al remover')
      }
    })
  }

  const onChangeDriver = (campaignVehicleId: string, driverStaffId: string | null) => {
    if (!driverStaffId) return
    startTransition(async () => {
      try {
        await setDriver({ campaignVehicleId, driverStaffId })
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al asignar conductor')
      }
    })
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <header className="mb-4 flex items-center gap-2">
        <Truck className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Logística — Vehículos y conductores</h2>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {assigned.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay vehículos asignados a esta campaña.
          </p>
        )}
        {assigned.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-background p-3"
          >
            <div className="flex flex-col">
              <span className="font-mono text-sm font-medium">
                {a.plate}
                {a.mobileNumber ? ` · Móvil ${a.mobileNumber}` : ''}
              </span>
              <span className="text-xs text-muted-foreground">
                {a.model ?? '—'}
                {a.capacity ? ` · ${a.capacity} pax` : ''}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <UserSquare2 className="size-4 text-muted-foreground" />
              {canEdit ? (
                <Select
                  value={a.driverStaffId ?? ''}
                  onValueChange={(v) => onChangeDriver(a.id, v)}
                  disabled={pending}
                >
                  <SelectTrigger className="h-8 w-72">
                    <SelectValue placeholder="Asignar conductor…">
                      {a.driverFullName
                        ? `${a.driverFullName}${a.driverCedula ? ` — C.C. ${a.driverCedula}` : ''}`
                        : 'Sin conductor'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableDrivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.lastName}, {d.firstName} — C.C. {d.cedula}
                      </SelectItem>
                    ))}
                    {/* Permite ver el conductor actual aunque no esté en la lista
                        de "disponibles" (porque ya está asignado a esta campaña). */}
                    {a.driverFullName && a.driverStaffId && !availableDrivers.some((d) => d.id === a.driverStaffId) && (
                      <SelectItem value={a.driverStaffId}>
                        {a.driverFullName}{a.driverCedula ? ` — C.C. ${a.driverCedula}` : ''}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm">
                  {a.driverFullName ?? 'Sin conductor'}
                  {a.driverCedula && (
                    <span className="ml-2 text-xs text-muted-foreground font-mono">
                      C.C. {a.driverCedula}
                    </span>
                  )}
                </span>
              )}
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(a.id)}
                  disabled={pending}
                  aria-label="Remover asignación"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Vehículo disponible
              </label>
              <Select
                value={selectedVehicle}
                onValueChange={(v) => setSelectedVehicle(v ?? '')}
                disabled={pending || availableVehicles.length === 0}
              >
                <SelectTrigger className="h-9 w-72">
                  {/*
                    Base UI no infiere el label del trigger desde los
                    SelectItems al estar cerrado: tenemos que renderizar
                    manualmente la placa/móvil/modelo del vehículo elegido
                    o mostraría el UUID en bruto.
                  */}
                  <SelectValue placeholder="Seleccionar vehículo">
                    {(() => {
                      if (!selectedVehicle) return 'Seleccionar vehículo'
                      const v = availableVehicles.find((x) => x.id === selectedVehicle)
                      if (!v) return 'Seleccionar vehículo'
                      return `${v.plate}${v.mobileNumber ? ` · Móvil ${v.mobileNumber}` : ''}${v.model ? ` · ${v.model}` : ''}`
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableVehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.plate}
                      {v.mobileNumber ? ` · Móvil ${v.mobileNumber}` : ''}
                      {v.model ? ` · ${v.model}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Conductor (opcional)
              </label>
              <Select
                value={selectedDriver}
                onValueChange={(v) => setSelectedDriver(v ?? '')}
                disabled={pending || availableDrivers.length === 0}
              >
                <SelectTrigger className="h-9 w-72">
                  <SelectValue placeholder="Seleccionar conductor">
                    {(() => {
                      if (!selectedDriver) return 'Seleccionar conductor'
                      const d = availableDrivers.find((x) => x.id === selectedDriver)
                      if (!d) return 'Seleccionar conductor'
                      return `${d.lastName}, ${d.firstName} — C.C. ${d.cedula}`
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableDrivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.lastName}, {d.firstName} — C.C. {d.cedula}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={onAssign}
              disabled={!selectedVehicle || pending}
            >
              {pending ? 'Asignando…' : 'Asignar'}
            </Button>
          </div>
          {availableVehicles.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              No hay vehículos disponibles para las fechas de esta campaña.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
