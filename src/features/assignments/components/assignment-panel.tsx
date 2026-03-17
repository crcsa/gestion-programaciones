'use client'

import { useState, useEffect, useCallback } from 'react'
import { RequirementsMeter } from './requirements-meter'
import { AssignedStaffList } from './assigned-staff-list'
import { StaffSelector } from './staff-selector'
import {
  getAssignedStaff,
  getAvailableStaff,
  assignStaff,
  removeAssignment,
  setCoordinator,
} from '../actions/assignment-actions'
import type { AssignedStaffMember, AvailableStaffMember } from '../actions/assignment-actions'
import type { Role } from '@/types/roles'

interface AssignmentPanelProps {
  campaignId: string
  campaignSize: 'S' | 'S_plus' | 'M' | 'L'
  campaignStatus: 'tentativa' | 'confirmada' | 'cancelada' | 'ejecutada'
  currentRole: Role | null
}

export function AssignmentPanel({
  campaignId,
  campaignSize,
  campaignStatus,
  currentRole,
}: AssignmentPanelProps) {
  const [assigned, setAssigned] = useState<AssignedStaffMember[]>([])
  const [available, setAvailable] = useState<AvailableStaffMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isEditable =
    campaignStatus === 'confirmada' &&
    (currentRole === 'admin' || currentRole === 'banco_sangre')

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [assignedData, availableData] = await Promise.all([
        getAssignedStaff(campaignId),
        getAvailableStaff(campaignId),
      ])
      setAssigned(assignedData)
      setAvailable(availableData)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al cargar datos de asignación'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAssign = async (staffIds: string[]) => {
    try {
      await assignStaff({ campaignId, staffIds })
      await fetchData()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al asignar personal'
      setError(message)
    }
  }

  const handleRemove = async (assignmentId: string) => {
    try {
      await removeAssignment(assignmentId)
      await fetchData()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al remover asignación'
      setError(message)
    }
  }

  const handleSetCoordinator = async (staffId: string) => {
    try {
      await setCoordinator({ campaignId, staffId })
      await fetchData()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al designar coordinador'
      setError(message)
    }
  }

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Cargando asignaciones...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <RequirementsMeter size={campaignSize} assigned={assigned} />

      <div>
        <h3 className="font-semibold mb-3">
          Personal asignado ({assigned.length})
        </h3>
        <AssignedStaffList
          assigned={assigned}
          onRemove={handleRemove}
          onSetCoordinator={handleSetCoordinator}
          isEditable={isEditable}
        />
      </div>

      {isEditable && available.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Agregar personal</h3>
          <StaffSelector
            available={available}
            onAssign={handleAssign}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  )
}
