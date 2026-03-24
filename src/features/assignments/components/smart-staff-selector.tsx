'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { StaffTrafficLight } from './staff-traffic-light'
import { OverrideConfirmationDialog } from './override-confirmation-dialog'
import {
  getStaffAssignmentStatuses,
  assignStaffWithValidation,
  type StaffAssignmentStatus,
} from '../actions/smart-assignment-actions'
import type { ValidationResult } from '../lib/validation-engine'

interface SmartStaffSelectorProps {
  campaignId: string
  onAssigned: () => void
}

export function SmartStaffSelector({ campaignId, onAssigned }: SmartStaffSelectorProps) {
  const [statuses, setStatuses] = useState<StaffAssignmentStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingStaff, setPendingStaff] = useState<{
    staffId: string
    staffName: string
    warnings: ValidationResult[]
  } | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null)

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

  const handleAssign = async (staffId: string, forceOverride = false) => {
    setAssigning(staffId)
    try {
      const result = await assignStaffWithValidation({ campaignId, staffId, forceOverride })
      if ('requiresConfirmation' in result) {
        const staff = statuses.find((s) => s.staffId === staffId)
        setPendingStaff({
          staffId,
          staffName: staff ? `${staff.firstName} ${staff.lastName}` : staffId,
          warnings: result.warnings,
        })
      } else {
        setPendingStaff(null)
        onAssigned()
        await fetchStatuses()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar')
    } finally {
      setAssigning(null)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-2">Cargando personal...</p>
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (statuses.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">No hay personal disponible para asignar.</p>
  }

  return (
    <TooltipProvider>
      <div className="space-y-1">
        {statuses.map((staff) => {
          const blockMessages = staff.validationResults
            .filter((r) => r.severity === 'block')
            .map((r) => r.message)
            .join('; ')

          return (
            <div
              key={staff.staffId}
              className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50 transition-colors"
            >
              <StaffTrafficLight color={staff.trafficColor} size="sm" />
              <span className="flex-1 text-sm">
                {staff.firstName} {staff.lastName}
                <span className="ml-2 text-xs text-muted-foreground capitalize">
                  {staff.staffProfile}
                </span>
              </span>

              {staff.canAssign ? (
                <Button
                  size="sm"
                  variant={staff.validationResults.length > 0 ? 'outline' : 'default'}
                  onClick={() => handleAssign(staff.staffId)}
                  disabled={assigning === staff.staffId}
                >
                  {assigning === staff.staffId ? 'Asignando...' : 'Asignar'}
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <Button size="sm" variant="outline" disabled>
                      Bloqueado
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs text-xs">
                    {blockMessages}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )
        })}
      </div>

      {pendingStaff && (
        <OverrideConfirmationDialog
          open
          warnings={pendingStaff.warnings}
          staffName={pendingStaff.staffName}
          onConfirm={() => handleAssign(pendingStaff.staffId, true)}
          onCancel={() => setPendingStaff(null)}
        />
      )}
    </TooltipProvider>
  )
}
