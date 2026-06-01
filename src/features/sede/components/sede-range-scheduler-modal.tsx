'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  bulkUpsertRangeSedeShifts,
  getRangeConflicts,
  type RangeConflict,
  type StaffListItem,
} from '@/features/sede/actions/sede-shift-actions'
import {
  AssignmentRowsEditor,
  defaultRow,
  type RowState,
} from './assignment-rows-editor'
import {
  SEDE_SHIFT_DEFAULTS,
  SEDE_MODALITY_LABELS,
  DEFAULT_SHIFT_TYPE_BY_MODALITY,
  effectiveShiftHours,
  MIN_EFFECTIVE_HOURS_DIURNO,
  type ShiftType,
  type SedeModality,
} from '@/features/sede/lib/shift-defaults'
import type { DayAssignmentItem } from '@/features/sede/schemas/sede-shift-schemas'

interface SedeRangeSchedulerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dateFrom: string
  dateTo: string
  modality: SedeModality
  staffList: StaffListItem[]
  onSaved: () => void
}

function formatDateShort(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

function expandRangeDays(dateFrom: string, dateTo: string): string[] {
  const [y, m, d] = dateFrom.split('-').map(Number)
  const [y2, m2, d2] = dateTo.split('-').map(Number)
  const start = Date.UTC(y, m - 1, d)
  const end = Date.UTC(y2, m2 - 1, d2)
  const out: string[] = []
  for (let t = start; t <= end; t += 24 * 60 * 60 * 1000) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

export function SedeRangeSchedulerModal({
  open,
  onOpenChange,
  dateFrom,
  dateTo,
  modality,
  staffList,
  onSaved,
}: SedeRangeSchedulerModalProps) {
  const fallbackType = DEFAULT_SHIFT_TYPE_BY_MODALITY[modality]

  const rangeDays = useMemo(() => expandRangeDays(dateFrom, dateTo), [dateFrom, dateTo])

  // Conflictos por staff: en qué días tiene un turno de la OTRA modalidad.
  // Si tiene conflicto en TODOS los días del rango, se deshabilita en la
  // grilla; si solo en algunos, se deja seleccionable y al guardar el usuario
  // decide saltar o cancelar.
  const [conflictsByStaff, setConflictsByStaff] = useState<Map<string, Set<string>>>(new Map())
  const [loadingConflicts, setLoadingConflicts] = useState(false)

  const initialState = useMemo(() => {
    const map = new Map<string, RowState>()
    for (const s of staffList) {
      map.set(s.id, defaultRow(fallbackType))
    }
    return map
  }, [staffList, fallbackType])

  const [rows, setRows] = useState<Map<string, RowState>>(initialState)
  const [search, setSearch] = useState('')
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Dialog de confirmación para saltar días con conflictos parciales.
  const [pendingSkip, setPendingSkip] = useState<{
    skipDates: string[]
    affected: Array<{ date: string; staffName: string }>
    assignments: DayAssignmentItem[]
  } | null>(null)

  // Carga inicial de conflictos cuando se abre el modal o cambia el rango.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      setLoadingConflicts(true)
      try {
        const staffIds = staffList.map((s) => s.id)
        if (staffIds.length === 0) {
          if (!cancelled) setConflictsByStaff(new Map())
          return
        }
        const res = await getRangeConflicts({ dateFrom, dateTo, modality, staffIds })
        if (cancelled) return
        const map = new Map<string, Set<string>>()
        for (const c of res) {
          const set = map.get(c.staffId) ?? new Set<string>()
          set.add(c.date)
          map.set(c.staffId, set)
        }
        setConflictsByStaff(map)
      } catch {
        // En error dejamos vacío; el server hará el pre-flight definitivo.
        if (!cancelled) setConflictsByStaff(new Map())
      } finally {
        if (!cancelled) setLoadingConflicts(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [open, dateFrom, dateTo, modality, staffList])

  // Staff con conflicto en TODOS los días del rango → deshabilitado en grilla.
  const otherModalityByStaff = useMemo(() => {
    const map = new Map<string, SedeModality>()
    const otherModality: SedeModality = modality === 'sede' ? 'servicios' : 'sede'
    for (const [staffId, dates] of conflictsByStaff.entries()) {
      if (dates.size === rangeDays.length) {
        map.set(staffId, otherModality)
      }
    }
    return map
  }, [conflictsByStaff, rangeDays.length, modality])

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSearch('')
      setError(null)
      setExpandedStaffId(null)
      setPendingSkip(null)
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

  function buildAssignmentsOrNull(): {
    assignments: DayAssignmentItem[]
    tooShort: string[]
  } {
    const assignments: DayAssignmentItem[] = []
    const tooShort: string[] = []
    for (const s of staffList) {
      const r = rows.get(s.id)
      if (!r?.selected) continue
      if (otherModalityByStaff.has(s.id)) continue
      const defaults = SEDE_SHIFT_DEFAULTS[r.shiftType]
      const startTime = r.customTimes ? r.startTime : defaults.startTime
      const endTime = r.customTimes ? r.endTime : defaults.endTime
      const isOvernight = r.customTimes ? r.isOvernight : defaults.isOvernight
      if (
        r.shiftType === 'diurno_completo' ||
        r.shiftType === 'servicios_transfusionales'
      ) {
        const eff = effectiveShiftHours(startTime, endTime, isOvernight, r.shiftType as ShiftType)
        if (eff < MIN_EFFECTIVE_HOURS_DIURNO) {
          tooShort.push(`${s.lastName}, ${s.firstName} (${eff}h efectivas)`)
          continue
        }
      }
      assignments.push({
        staffId: s.id,
        shiftType: r.shiftType,
        startTime: r.customTimes ? r.startTime : undefined,
        endTime: r.customTimes ? r.endTime : undefined,
        isOvernight: r.customTimes ? r.isOvernight : undefined,
        notes: r.notes.trim() ? r.notes.trim() : undefined,
      })
    }
    return { assignments, tooShort }
  }

  async function commitSave(assignments: DayAssignmentItem[], skipDates: string[]) {
    try {
      const res = await bulkUpsertRangeSedeShifts({
        dateFrom,
        dateTo,
        modality,
        assignments,
        skipDates,
      })
      toast.success(
        `Programación de rango: ${res.upserted} turno${res.upserted === 1 ? '' : 's'} en ${res.daysProcessed} día${res.daysProcessed === 1 ? '' : 's'}` +
          (res.removed > 0 ? `, ${res.removed} removido${res.removed === 1 ? '' : 's'}` : ''),
      )
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    if (busy) return
    setError(null)
    setBusy(true)

    const { assignments, tooShort } = buildAssignmentsOrNull()

    if (tooShort.length > 0) {
      setError(
        `Los turnos diurnos requieren al menos ${MIN_EFFECTIVE_HOURS_DIURNO}h efectivas ` +
          `(descontando 1h de almuerzo). Ajusta a:\n• ${tooShort.join('\n• ')}`,
      )
      setBusy(false)
      return
    }

    if (assignments.length === 0) {
      setError('Selecciona al menos un colaborador para programar el rango.')
      setBusy(false)
      return
    }

    // Re-check de conflictos con el subset realmente seleccionado.
    let conflicts: RangeConflict[] = []
    try {
      conflicts = await getRangeConflicts({
        dateFrom,
        dateTo,
        modality,
        staffIds: assignments.map((a) => a.staffId),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error verificando conflictos')
      setBusy(false)
      return
    }

    if (conflicts.length === 0) {
      await commitSave(assignments, [])
      return
    }

    // Hay conflictos en algunos días → pedir confirmación para saltar.
    const skipDatesSet = new Set<string>()
    const affected: Array<{ date: string; staffName: string }> = []
    const staffById = new Map(staffList.map((s) => [s.id, s]))
    for (const c of conflicts) {
      skipDatesSet.add(c.date)
      const s = staffById.get(c.staffId)
      const name = s ? `${s.lastName}, ${s.firstName}` : c.staffId
      affected.push({ date: c.date, staffName: name })
    }
    setPendingSkip({
      skipDates: Array.from(skipDatesSet).sort(),
      affected,
      assignments,
    })
    setBusy(false)
  }

  async function confirmSkipAndSave() {
    if (!pendingSkip) return
    const { assignments, skipDates } = pendingSkip
    setPendingSkip(null)
    setBusy(true)
    await commitSave(assignments, skipDates)
  }

  const headerLabel = `${formatDateShort(dateFrom)} – ${formatDateShort(dateTo)}`
  const daysCount = rangeDays.length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto overflow-x-hidden"
        style={{ maxWidth: 'min(48rem, calc(100vw - 2rem))', width: '100%' }}
      >
        <DialogHeader>
          <DialogTitle>
            Programar rango: {headerLabel} ({daysCount} día{daysCount === 1 ? '' : 's'}) —{' '}
            {SEDE_MODALITY_LABELS[modality]}
          </DialogTitle>
          <DialogDescription>
            {loadingConflicts ? (
              <>Verificando conflictos con la otra modalidad…</>
            ) : (
              <>
                La misma programación se aplicará a los {daysCount} día
                {daysCount === 1 ? '' : 's'} del rango. Si algún colaborador tiene un turno de la
                otra modalidad en alguno de esos días, al guardar te pediremos confirmar saltar
                esos días.
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
          <Button onClick={handleSave} disabled={busy || loadingConflicts}>
            {busy
              ? 'Guardando...'
              : `Guardar ${selectedCount} × ${daysCount} día${daysCount === 1 ? '' : 's'}`}
          </Button>
        </div>
      </DialogContent>

      {/* Dialog confirmando saltar días con conflictos parciales */}
      <Dialog open={!!pendingSkip} onOpenChange={(o) => !o && setPendingSkip(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hay conflictos en algunos días</DialogTitle>
            <DialogDescription>
              Estos días tienen un turno previo de la otra modalidad para alguno de los
              colaboradores seleccionados. Puedes saltarlos y programar el resto, o cancelar y
              revisar.
            </DialogDescription>
          </DialogHeader>
          {pendingSkip && (
            <div className="max-h-60 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-sm">
              <ul className="space-y-1">
                {pendingSkip.affected.slice(0, 30).map((a, i) => (
                  <li key={`${a.date}-${a.staffName}-${i}`} className="truncate">
                    <span className="font-mono text-xs">{a.date}</span> — {a.staffName}
                  </li>
                ))}
                {pendingSkip.affected.length > 30 && (
                  <li className="text-xs italic text-muted-foreground">
                    +{pendingSkip.affected.length - 30} más
                  </li>
                )}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingSkip(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmSkipAndSave}>
              Saltar y guardar ({pendingSkip ? pendingSkip.skipDates.length : 0} día
              {pendingSkip && pendingSkip.skipDates.length === 1 ? '' : 's'} omitido
              {pendingSkip && pendingSkip.skipDates.length === 1 ? '' : 's'})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
