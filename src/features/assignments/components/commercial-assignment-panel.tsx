'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, UserPlus } from 'lucide-react'
import {
  getAssignedCommercialStaff,
  getAvailableCommercialStaff,
  assignCommercialStaff,
  removeCommercialAssignment,
} from '../actions/commercial-assignment-actions'
import type {
  CommercialStaffAssignment,
  CommercialStaffCandidate,
} from '../actions/commercial-assignment-actions'

interface CommercialAssignmentPanelProps {
  campaignId: string
  campaignStatus: 'tentativa' | 'confirmada' | 'cancelada' | 'ejecutada'
  /**
   * Si true, muestra el selector para asignar. Read-only para áreas no comerciales.
   * Calculado en el server con `canAccess` + `area==='comercial'`.
   */
  canEdit: boolean
}

export function CommercialAssignmentPanel({
  campaignId,
  campaignStatus,
  canEdit,
}: CommercialAssignmentPanelProps) {
  const [assigned, setAssigned] = useState<CommercialStaffAssignment[]>([])
  const [available, setAvailable] = useState<CommercialStaffCandidate[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // La edición sólo se habilita en confirmada (igual que banco_sangre + logística).
  const isEditable = canEdit && campaignStatus === 'confirmada'

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [assignedData, availableData] = await Promise.all([
        getAssignedCommercialStaff(campaignId),
        isEditable ? getAvailableCommercialStaff(campaignId) : Promise.resolve([]),
      ])
      setAssigned(assignedData)
      setAvailable(availableData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar operativos comerciales')
    } finally {
      setIsLoading(false)
    }
  }, [campaignId, isEditable])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAssign = async () => {
    if (!selectedStaffId) return
    setIsSubmitting(true)
    setError(null)
    try {
      await assignCommercialStaff({ campaignId, staffIds: [selectedStaffId] })
      setSelectedStaffId('')
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar operativo')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemove = async (assignmentId: string) => {
    setError(null)
    try {
      await removeCommercialAssignment(assignmentId)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al remover asignación')
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4">Cargando operativos comerciales...</div>
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div>
        <h3 className="font-semibold mb-3">
          Operativos comerciales asignados ({assigned.length})
        </h3>
        {assigned.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No hay operativos comerciales asignados.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {assigned.map((a) => (
              <li key={a.assignmentId} className="flex items-center justify-between px-3 py-2">
                <span className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-medium">
                    {a.lastName}, {a.firstName}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    C.C. {a.cedula}
                  </span>
                </span>
                {isEditable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(a.assignmentId)}
                    aria-label="Remover"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isEditable && (
        <div>
          <h3 className="font-semibold mb-3">Agregar operativo comercial</h3>
          <div className="flex gap-2">
            <Select
              value={selectedStaffId}
              onValueChange={(v) => setSelectedStaffId(v ?? '')}
            >
              <SelectTrigger className="flex-1">
                {/*
                  Base UI no infiere el label desde los SelectItems al estar
                  cerrado, así que lo derivamos manualmente del `available`
                  para evitar mostrar el UUID.
                */}
                <SelectValue placeholder="Seleccionar operativo">
                  {(() => {
                    if (!selectedStaffId) return 'Seleccionar operativo'
                    const s = available.find((x) => x.id === selectedStaffId)
                    return s
                      ? `${s.lastName}, ${s.firstName} — C.C. ${s.cedula}`
                      : 'Seleccionar operativo'
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {available.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No hay operativos disponibles
                  </SelectItem>
                ) : (
                  available.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.lastName}, {s.firstName} — C.C. {s.cedula}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAssign}
              disabled={!selectedStaffId || isSubmitting}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Asignar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
