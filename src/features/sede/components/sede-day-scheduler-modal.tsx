'use client'

import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { bulkUpsertDaySedeShifts } from '@/features/sede/actions/sede-shift-actions'
import { validateBulkSedeShifts } from '@/features/sede/actions/sede-shift-validation'
import { SedeWarningsDialog, type StaffWarningGroup } from './sede-warnings-dialog'
import {
  AssignmentRowsEditor,
  defaultRow,
  type RowState,
} from './assignment-rows-editor'
import {
  SEDE_SHIFT_DEFAULTS,
  SEDE_MODALITY_LABELS,
  MODALITY_BY_SHIFT_TYPE,
  DEFAULT_SHIFT_TYPE_BY_MODALITY,
  effectiveShiftHours,
  MIN_EFFECTIVE_HOURS_DIURNO,
  type ShiftType,
  type SedeModality,
} from '@/features/sede/lib/shift-defaults'
import type {
  SedeShiftRow,
  StaffListItem,
} from '@/features/sede/actions/sede-shift-actions'
import type { DayAssignmentItem } from '@/features/sede/schemas/sede-shift-schemas'

interface SedeDaySchedulerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shiftDate: string
  existing: SedeShiftRow[]
  staffList: StaffListItem[]
  modality: SedeModality
  onSaved: () => void
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function SedeDaySchedulerModal({
  open,
  onOpenChange,
  shiftDate,
  existing,
  staffList,
  modality,
  onSaved,
}: SedeDaySchedulerModalProps) {
  const fallbackType = DEFAULT_SHIFT_TYPE_BY_MODALITY[modality]

  // Staff con turno previo de la OTRA modalidad ese día (deshabilitados).
  // Un turno por persona/día: no se les puede programar aquí sin quitar antes
  // el de la otra modalidad.
  const otherModalityByStaff = useMemo(() => {
    const map = new Map<string, SedeModality>()
    for (const e of existing) {
      const mod = MODALITY_BY_SHIFT_TYPE[e.shiftType]
      if (mod !== modality) map.set(e.staffId, mod)
    }
    return map
  }, [existing, modality])

  // Estado inicial: por cada staff visible, marcado si tiene shift previo DE
  // ESTA MODALIDAD. Los turnos de la otra modalidad no se hidratan (se
  // gestionan desde su propio flujo).
  const initialState = useMemo(() => {
    const visibleIds = new Set(staffList.map((s) => s.id))
    const map = new Map<string, RowState>()
    for (const s of staffList) {
      map.set(s.id, defaultRow(fallbackType))
    }
    for (const e of existing) {
      if (!visibleIds.has(e.staffId)) continue
      if (MODALITY_BY_SHIFT_TYPE[e.shiftType] !== modality) continue
      const def = SEDE_SHIFT_DEFAULTS[e.shiftType]
      const customTimes = e.startTime !== def.startTime || e.endTime !== def.endTime
      map.set(e.staffId, {
        selected: true,
        shiftType: e.shiftType,
        startTime: e.startTime,
        endTime: e.endTime,
        isOvernight: e.isOvernight,
        notes: e.notes ?? '',
        customTimes,
      })
    }
    return map
  }, [staffList, existing, modality, fallbackType])

  const [rows, setRows] = useState<Map<string, RowState>>(initialState)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null)
  const [warningGroups, setWarningGroups] = useState<StaffWarningGroup[] | null>(null)
  const pendingResolveRef = useRef<((ok: boolean) => void) | null>(null)

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSearch('')
      setError(null)
      setExpandedStaffId(null)
    } else {
      setRows(new Map(initialState))
    }
    onOpenChange(next)
  }

  const selectedCount = useMemo(() => {
    let n = 0
    for (const s of staffList) {
      if (rows.get(s.id)?.selected) n++
    }
    return n
  }, [rows, staffList])

  async function handleSave() {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const assignments: DayAssignmentItem[] = []
      const validationItems: Array<{
        staffId: string
        startTime: string
        endTime: string
        isOvernight: boolean
        shiftType: ShiftType
      }> = []
      const tooShort: string[] = []
      // Iteramos staffList (visible) en vez de rows.entries() para no enviar
      // assignments de staff fuera del scope del caller. El server también
      // valida pertenencia de área pero blindar aquí evita un round-trip.
      for (const s of staffList) {
        const r = rows.get(s.id)
        if (!r?.selected) continue
        if (otherModalityByStaff.has(s.id)) continue
        const staffId = s.id
        const defaults = SEDE_SHIFT_DEFAULTS[r.shiftType]
        const startTime = r.customTimes ? r.startTime : defaults.startTime
        const endTime = r.customTimes ? r.endTime : defaults.endTime
        const isOvernight = r.customTimes ? r.isOvernight : defaults.isOvernight
        if (
          r.shiftType === 'diurno_completo' ||
          r.shiftType === 'servicios_transfusionales'
        ) {
          const eff = effectiveShiftHours(startTime, endTime, isOvernight, r.shiftType)
          if (eff < MIN_EFFECTIVE_HOURS_DIURNO) {
            tooShort.push(`${s.lastName}, ${s.firstName} (${eff}h efectivas)`)
            continue
          }
        }
        assignments.push({
          staffId,
          shiftType: r.shiftType,
          startTime: r.customTimes ? r.startTime : undefined,
          endTime: r.customTimes ? r.endTime : undefined,
          isOvernight: r.customTimes ? r.isOvernight : undefined,
          notes: r.notes.trim() ? r.notes.trim() : undefined,
        })
        validationItems.push({ staffId, startTime, endTime, isOvernight, shiftType: r.shiftType })
      }

      if (tooShort.length > 0) {
        setError(
          `Los turnos diurnos requieren al menos ${MIN_EFFECTIVE_HOURS_DIURNO}h efectivas ` +
            `(descontando 1h de almuerzo). Ajusta a:\n• ${tooShort.join('\n• ')}`,
        )
        setBusy(false)
        return
      }

      if (validationItems.length > 0) {
        const validations = await validateBulkSedeShifts({
          shiftDate,
          assignments: validationItems,
        })
        const staffById = new Map(staffList.map((s) => [s.id, s]))
        const blocks = validations.filter((v) => v.hasBlock)
        const warns = validations.filter((v) => v.hasWarn && !v.hasBlock)

        if (blocks.length > 0) {
          const msg = blocks
            .map((b) => {
              const s = staffById.get(b.staffId)
              const name = s ? `${s.lastName}, ${s.firstName}` : b.staffId
              return `• ${name}: ${b.results.filter((r) => r.severity === 'block')[0]?.message ?? ''}`
            })
            .join('\n')
          setError(`No se puede guardar — bloqueos:\n${msg}`)
          setBusy(false)
          return
        }

        if (warns.length > 0) {
          const groups: StaffWarningGroup[] = warns.map((w) => {
            const s = staffById.get(w.staffId)
            const name = s ? `${s.lastName}, ${s.firstName}` : w.staffId
            return {
              staffName: name,
              warnings: w.results.filter((r) => r.severity === 'warn'),
            }
          })
          const confirmed = await new Promise<boolean>((resolve) => {
            pendingResolveRef.current = resolve
            setWarningGroups(groups)
          })
          if (!confirmed) {
            setBusy(false)
            return
          }
        }
      }

      const res = await bulkUpsertDaySedeShifts({ shiftDate, modality, assignments })
      toast.success(
        `Programación guardada: ${res.upserted} turno${res.upserted === 1 ? '' : 's'}${res.removed > 0 ? `, ${res.removed} removido${res.removed === 1 ? '' : 's'}` : ''}`,
      )
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setBusy(false)
    }
  }

  function handleWarningConfirm() {
    setWarningGroups(null)
    if (pendingResolveRef.current) {
      pendingResolveRef.current(true)
      pendingResolveRef.current = null
    }
  }

  function handleWarningCancel() {
    setWarningGroups(null)
    if (pendingResolveRef.current) {
      pendingResolveRef.current(false)
      pendingResolveRef.current = null
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto overflow-x-hidden"
        style={{ maxWidth: 'min(48rem, calc(100vw - 2rem))', width: '100%' }}
      >
        <DialogHeader>
          <DialogTitle>
            {SEDE_MODALITY_LABELS[modality]} — {formatDayHeader(shiftDate)}
          </DialogTitle>
          <DialogDescription>
            {modality === 'servicios' ? (
              <>
                Marca a los colaboradores en <strong>Servicios transfusionales</strong> ese día
                (07:00–17:00, 9h efectivas); ajusta el horario por persona si aplica. Solo afecta
                esta modalidad: los turnos de sede regular del día no se modifican.
              </>
            ) : (
              <>
                Marca a los colaboradores que estarán en sede ese día. Por defecto quedan en{' '}
                <strong>Diurno Completo</strong>; ajusta el tipo o el horario por persona si
                aplica. Solo afecta esta modalidad: los turnos de servicios transfusionales del
                día no se modifican.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <AssignmentRowsEditor
          rows={rows}
          setRows={setRows}
          staffList={staffList}
          otherModalityByStaff={otherModalityByStaff}
          modality={modality}
          expandedStaffId={expandedStaffId}
          setExpandedStaffId={setExpandedStaffId}
          search={search}
          setSearch={setSearch}
          fallbackType={fallbackType}
        />

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive whitespace-pre-line">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy
              ? 'Guardando...'
              : `Guardar ${selectedCount} turno${selectedCount === 1 ? '' : 's'}`}
          </Button>
        </div>
      </DialogContent>

      <SedeWarningsDialog
        open={!!warningGroups}
        groups={warningGroups ?? []}
        title="Confirmar programación con advertencias"
        confirmLabel="Guardar de todos modos"
        onConfirm={handleWarningConfirm}
        onCancel={handleWarningCancel}
      />
    </Dialog>
  )
}
