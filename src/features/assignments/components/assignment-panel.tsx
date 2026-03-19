'use client'

import { useState, useEffect, useCallback } from 'react'
import { RequirementsMeter } from './requirements-meter'
import { AssignedStaffList } from './assigned-staff-list'
import { SmartStaffSelector } from './smart-staff-selector'
import {
  getAssignedStaff,
  removeAssignment,
  setCoordinator,
} from '../actions/assignment-actions'
import type { AssignedStaffMember } from '../actions/assignment-actions'
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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isEditable =
    campaignStatus === 'confirmada' &&
    (currentRole === 'admin' || currentRole === 'banco_sangre')

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const assignedData = await getAssignedStaff(campaignId)
      setAssigned(assignedData)
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

      {isEditable && (
        <div>
          <h3 className="font-semibold mb-3">Agregar personal</h3>
          <SmartStaffSelector campaignId={campaignId} onAssigned={fetchData} />
        </div>
      )}
    </div>
  )
}
