'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { StaffTrafficLight } from './staff-traffic-light'
import { BatchOverrideDialog } from './batch-override-dialog'
import {
  getStaffAssignmentStatuses,
  assignStaffBatchWithValidation,
  type StaffAssignmentStatus,
  type BatchAssignWarning,
} from '../actions/smart-assignment-actions'
import { CAMPAIGN_SIZE_COMPOSITION } from '@/features/campaigns/lib/constants'

interface SmartStaffSelectorProps {
  campaignId: string
  campaignSize: 'S' | 'S_plus' | 'M' | 'L'
  assignedBacteriologos: number
  assignedTecnicos: number
  onAssigned: () => void
}

export function SmartStaffSelector({
  campaignId,
  campaignSize,
  assignedBacteriologos,
  assignedTecnicos,
  onAssigned,
}: SmartStaffSelectorProps) {
  const [statuses, setStatuses] = useState<StaffAssignmentStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pendingWarnings, setPendingWarnings] = useState<BatchAssignWarning[] | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)

  const fetchStatuses = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getStaffAssignmentStatuses(campaignId)
      setStatuses(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el personal')
    } finally {
      setIsLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    fetchStatuses()
  }, [fetchStatuses])

  const required = CAMPAIGN_SIZE_COMPOSITION[campaignSize]
  const missingBact = Math.max(0, required.bacteriologos - assignedBacteriologos)
  const missingTec = Math.max(0, required.tecnicos - assignedTecnicos)

  const { selectedBact, selectedTec } = useMemo(() => {
    let bact = 0
    let tec = 0
    for (const s of statuses) {
      if (!selected.has(s.staffId)) continue
      if (s.staffProfile === 'bacteriologo') bact++
      else if (s.staffProfile === 'tecnico') tec++
    }
    return { selectedBact: bact, selectedTec: tec }
  }, [selected, statuses])

  const overBact = selectedBact > missingBact
  const overTec = selectedTec > missingTec

  function toggle(staffId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(staffId)) next.delete(staffId)
      else next.add(staffId)
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  async function performAssign(force: boolean) {
    setIsAssigning(true)
    try {
      const result = await assignStaffBatchWithValidation({
        campaignId,
        staffIds: Array.from(selected),
        forceOverride: force,
      })
      if ('requiresConfirmation' in result) {
        setPendingWarnings(result.warningsByStaff)
      } else {
        setPendingWarnings(null)
        setSelected(new Set())
        onAssigned()
        await fetchStatuses()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar')
    } finally {
      setIsAssigning(false)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-2">Cargando personal...</p>
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 flex items-center justify-between gap-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button size="sm" variant="outline" onClick={() => fetchStatuses()}>
          Reintentar
        </Button>
      </div>
    )
  }

  if (statuses.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">No hay personal disponible para asignar.</p>
  }

  const totalSelected = selected.size

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-medium">Selección:</span>
            <span className={`tabular-nums ${overBact ? 'text-destructive' : 'text-foreground'}`}>
              {selectedBact} / {missingBact} bact
            </span>
            <span className={`tabular-nums ${overTec ? 'text-destructive' : 'text-foreground'}`}>
              {selectedTec} / {missingTec} téc
            </span>
            {(overBact || overTec) && (
              <span className="inline-flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="size-3.5" /> Excede lo requerido
              </span>
            )}
          </div>
          {totalSelected > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection} disabled={isAssigning}>
              Limpiar
            </Button>
          )}
        </div>

        <div className="rounded-md border border-border divide-y divide-border">
          {statuses.map((staff) => {
            const isSelected = selected.has(staff.staffId)
            const warnings = staff.validationResults.filter((r) => r.severity === 'warn')
            const blockMessages = staff.validationResults
              .filter((r) => r.severity === 'block')
              .map((r) => r.message)
              .join('; ')

            const rowDisabled = !staff.canAssign
            const labelId = `staff-${staff.staffId}`

            return (
              <label
                key={staff.staffId}
                htmlFor={labelId}
                className={`flex items-center gap-3 px-3 py-2 transition-colors ${
                  rowDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : isSelected
                      ? 'bg-primary/5 cursor-pointer'
                      : 'hover:bg-muted/50 cursor-pointer'
                }`}
              >
                <input
                  id={labelId}
                  type="checkbox"
                  checked={isSelected}
                  disabled={rowDisabled || isAssigning}
                  onChange={() => toggle(staff.staffId)}
                  className="size-4 rounded border-input text-primary accent-primary"
                />
                <StaffTrafficLight color={staff.trafficColor} size="sm" />
                <span className="flex-1 text-sm">
                  {staff.firstName} {staff.lastName}
                  <span className="ml-2 text-xs text-muted-foreground font-mono">
                    C.C. {staff.cedula}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground capitalize">
                    {staff.staffProfile}
                  </span>
                </span>
                {rowDisabled && (
                  <Tooltip>
                    <TooltipTrigger render={<span />}>
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                        Bloqueado
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs text-xs">
                      {blockMessages}
                    </TooltipContent>
                  </Tooltip>
                )}
                {!rowDisabled && warnings.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger render={<span />}>
                      <AlertTriangle className="size-4 text-amber-500" aria-label="Advertencias" />
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs text-xs">
                      <ul className="space-y-1">
                        {warnings.map((w) => (
                          <li key={w.code}>{w.message}</li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                )}
              </label>
            )
          })}
        </div>

        <div className="sticky bottom-2 flex justify-end">
          <Button
            size="lg"
            disabled={totalSelected === 0 || isAssigning}
            onClick={() => performAssign(false)}
          >
            {isAssigning
              ? 'Asignando...'
              : totalSelected === 0
                ? 'Selecciona colaboradores'
                : `Asignar ${totalSelected} colaborador${totalSelected === 1 ? '' : 'es'}`}
          </Button>
        </div>
      </div>

      {pendingWarnings && (
        <BatchOverrideDialog
          open
          warningsByStaff={pendingWarnings}
          totalSelected={totalSelected}
          isAssigning={isAssigning}
          onConfirm={() => performAssign(true)}
          onCancel={() => setPendingWarnings(null)}
        />
      )}
    </TooltipProvider>
  )
}
