'use client'

import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { bulkUpsertDaySedeShifts } from '@/features/sede/actions/sede-shift-actions'
import { validateBulkSedeShifts } from '@/features/sede/actions/sede-shift-validation'
import { SedeWarningsDialog, type StaffWarningGroup } from './sede-warnings-dialog'
import {
  SEDE_SHIFT_DEFAULTS,
  SHIFT_TYPE_LABELS,
  effectiveShiftHours,
  MIN_EFFECTIVE_HOURS_DIURNO,
  type ShiftType,
} from '@/features/sede/lib/shift-defaults'
import { STAFF_PROFILE_LABELS, type StaffProfile } from '@/features/staff/lib/constants'
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
  onSaved: () => void
}

interface RowState {
  selected: boolean
  shiftType: ShiftType
  startTime: string
  endTime: string
  isOvernight: boolean
  notes: string
  customTimes: boolean
}

function defaultRow(shiftType: ShiftType = 'diurno_completo'): RowState {
  const d = SEDE_SHIFT_DEFAULTS[shiftType]
  return {
    selected: false,
    shiftType,
    startTime: d.startTime,
    endTime: d.endTime,
    isOvernight: d.isOvernight,
    notes: '',
    customTimes: false,
  }
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
  onSaved,
}: SedeDaySchedulerModalProps) {
  // Estado inicial: por cada staff de staffList, marcado si tiene shift previo.
  // Defensa profunda: solo hidratamos rows para staff QUE ESTÁ en staffList
  // (mismo scope del caller). Si `existing` trae filas para staff de otra
  // área (no debería tras el filtro server-side), las ignoramos para que el
  // conteo "X seleccionados" y los upserts no incluyan staff invisible.
  const initialState = useMemo(() => {
    const visibleIds = new Set(staffList.map((s) => s.id))
    const map = new Map<string, RowState>()
    for (const s of staffList) {
      map.set(s.id, defaultRow())
    }
    for (const e of existing) {
      if (!visibleIds.has(e.staffId)) continue
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
  }, [staffList, existing])

  const [rows, setRows] = useState<Map<string, RowState>>(initialState)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null)
  const [warningGroups, setWarningGroups] = useState<StaffWarningGroup[] | null>(null)
  const pendingResolveRef = useRef<((ok: boolean) => void) | null>(null)

  // Resetea estado cuando la modal se vuelve a abrir
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

  // Solo contamos filas que pertenecen al staffList visible (mismo scope del
  // caller). Evita contar staff de otra área que pudiera haberse colado.
  const selectedCount = useMemo(() => {
    let n = 0
    for (const s of staffList) {
      if (rows.get(s.id)?.selected) n++
    }
    return n
  }, [rows, staffList])

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return staffList
    return staffList.filter((s) =>
      `${s.firstName} ${s.lastName} ${s.staffProfile}`.toLowerCase().includes(q),
    )
  }, [staffList, search])

  function updateRow(staffId: string, patch: Partial<RowState>) {
    setRows((prev) => {
      const current = prev.get(staffId) ?? defaultRow()
      const next = new Map(prev)
      next.set(staffId, { ...current, ...patch })
      return next
    })
  }

  function handleShiftTypeChange(staffId: string, shiftType: ShiftType) {
    setRows((prev) => {
      const current = prev.get(staffId) ?? defaultRow()
      const next = new Map(prev)
      // Si no tiene customTimes, refrescar a defaults del nuevo tipo.
      if (!current.customTimes) {
        const d = SEDE_SHIFT_DEFAULTS[shiftType]
        next.set(staffId, {
          ...current,
          shiftType,
          startTime: d.startTime,
          endTime: d.endTime,
          isOvernight: d.isOvernight,
        })
      } else {
        next.set(staffId, { ...current, shiftType })
      }
      return next
    })
  }

  function markAllDiurno() {
    setRows((prev) => {
      const next = new Map(prev)
      for (const s of filteredStaff) {
        const current = next.get(s.id) ?? defaultRow()
        if (!current.selected) continue // sólo ajusta a los ya seleccionados
        next.set(s.id, {
          ...current,
          shiftType: 'diurno_completo',
          startTime: SEDE_SHIFT_DEFAULTS.diurno_completo.startTime,
          endTime: SEDE_SHIFT_DEFAULTS.diurno_completo.endTime,
          isOvernight: false,
          customTimes: false,
        })
      }
      return next
    })
  }

  function clearAllVisible() {
    setRows((prev) => {
      const next = new Map(prev)
      for (const s of filteredStaff) {
        const current = next.get(s.id) ?? defaultRow()
        next.set(s.id, { ...current, selected: false })
      }
      return next
    })
  }

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
      // Validación local: bloquear si alguna fila diurno_completo queda
      // bajo el mínimo de 8h efectivas. Mensaje agrupado para que el admin
      // ajuste todas a la vez antes del round-trip al server.
      const tooShort: string[] = []
      // Iteramos staffList (visible) en vez de rows.entries() para no enviar
      // assignments de staff fuera del scope del caller. El server también
      // valida pertenencia de área en bulkUpsertDaySedeShifts pero blindar
      // aquí evita un round-trip que terminaría en ValidationError.
      for (const s of staffList) {
        const r = rows.get(s.id)
        if (!r?.selected) continue
        const staffId = s.id
        const defaults = SEDE_SHIFT_DEFAULTS[r.shiftType]
        const startTime = r.customTimes ? r.startTime : defaults.startTime
        const endTime = r.customTimes ? r.endTime : defaults.endTime
        const isOvernight = r.customTimes ? r.isOvernight : defaults.isOvernight
        if (r.shiftType === 'diurno_completo' || r.shiftType === 'servicios_transfusionales') {
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
        const validations = await validateBulkSedeShifts({ shiftDate, assignments: validationItems })
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

      const res = await bulkUpsertDaySedeShifts({ shiftDate, assignments })
      toast.success(
        `Programación guardada: ${res.upserted} turno${res.upserted === 1 ? '' : 's'}${res.removed > 0 ? `, ${res.removed} removido${res.removed === 1 ? '' : 's'}` : ''}`,
      )
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setBusy(false)
    }
    // En éxito no reseteamos busy: la modal se cierra.
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
          <DialogTitle>Programar turnos — {formatDayHeader(shiftDate)}</DialogTitle>
          <DialogDescription>
            Marca a los colaboradores que estarán en sede ese día. Por defecto quedan en{' '}
            <strong>Diurno Completo</strong>; ajusta el tipo o el horario por persona si aplica.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Buscar por nombre o perfil..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 flex-1 min-w-0"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={markAllDiurno}
              className="gap-1"
              disabled={selectedCount === 0}
              title="Aplica 'Diurno Completo' a los colaboradores ya seleccionados"
            >
              <Sparkles className="size-3.5" />
              Diurno a seleccionados
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={clearAllVisible} className="gap-1">
              <X className="size-3.5" />
              Desmarcar
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Mostrando {filteredStaff.length} de {staffList.length} colaboradores activos · {selectedCount}{' '}
          seleccionado{selectedCount === 1 ? '' : 's'}.
        </p>

        <div className="rounded-lg border border-border divide-y divide-border max-h-[420px] overflow-y-auto">
          {filteredStaff.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Sin coincidencias para la búsqueda.
            </p>
          ) : (
            filteredStaff.map((s) => {
              const row = rows.get(s.id) ?? defaultRow()
              const isExpanded = expandedStaffId === s.id
              return (
                <div key={s.id} className="p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      id={`chk-${s.id}`}
                      checked={row.selected}
                      onChange={(e) => updateRow(s.id, { selected: e.target.checked })}
                      className="h-4 w-4 rounded border-input shrink-0"
                    />
                    <Label
                      htmlFor={`chk-${s.id}`}
                      className="flex-1 min-w-0 cursor-pointer text-sm font-normal"
                    >
                      <span className="font-medium">
                        {s.lastName}, {s.firstName}
                      </span>
                      <span className="text-muted-foreground ml-1.5 text-xs">
                        ({STAFF_PROFILE_LABELS[s.staffProfile as StaffProfile] ?? s.staffProfile})
                      </span>
                    </Label>
                    {row.selected && (
                      <>
                        <div className="w-40 shrink-0">
                          <Select
                            value={row.shiftType}
                            onValueChange={(v) =>
                              handleShiftTypeChange(s.id, (v ?? 'diurno_completo') as ShiftType)
                            }
                          >
                            <SelectTrigger className="h-8 w-full text-xs">
                              <SelectValue>{SHIFT_TYPE_LABELS[row.shiftType]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="diurno_completo">{SHIFT_TYPE_LABELS.diurno_completo}</SelectItem>
                              <SelectItem value="servicios_transfusionales">{SHIFT_TYPE_LABELS.servicios_transfusionales}</SelectItem>
                              <SelectItem value="noche">{SHIFT_TYPE_LABELS.noche}</SelectItem>
                              <SelectItem value="posturno">{SHIFT_TYPE_LABELS.posturno}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <ShiftEffectiveBadge row={row} />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={() => setExpandedStaffId(isExpanded ? null : s.id)}
                        >
                          {isExpanded ? 'Ocultar' : 'Editar'}
                        </Button>
                      </>
                    )}
                  </div>

                  {row.selected && isExpanded && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pl-7 pt-1">
                      <div>
                        <Label htmlFor={`start-${s.id}`} className="text-xs">
                          Inicio
                        </Label>
                        <Input
                          id={`start-${s.id}`}
                          type="time"
                          value={row.startTime}
                          onChange={(e) =>
                            updateRow(s.id, { startTime: e.target.value, customTimes: true })
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`end-${s.id}`} className="text-xs">
                          Fin
                        </Label>
                        <Input
                          id={`end-${s.id}`}
                          type="time"
                          value={row.endTime}
                          onChange={(e) =>
                            updateRow(s.id, { endTime: e.target.value, customTimes: true })
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <input
                          type="checkbox"
                          id={`overnight-${s.id}`}
                          checked={row.isOvernight}
                          onChange={(e) =>
                            updateRow(s.id, { isOvernight: e.target.checked, customTimes: true })
                          }
                          className="h-4 w-4 rounded border-input"
                        />
                        <Label htmlFor={`overnight-${s.id}`} className="text-xs cursor-pointer">
                          Pernocta
                        </Label>
                      </div>
                      <div className="sm:col-span-1">
                        <Label htmlFor={`notes-${s.id}`} className="text-xs">
                          Notas
                        </Label>
                        <Input
                          id={`notes-${s.id}`}
                          type="text"
                          value={row.notes}
                          onChange={(e) => updateRow(s.id, { notes: e.target.value })}
                          className="h-8 text-xs"
                          placeholder="Opcional"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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

/**
 * Badge inline que muestra las horas efectivas del turno (post-almuerzo).
 * Si el turno es `diurno_completo` y queda bajo el mínimo de 8h, lo señala
 * en rojo para que el admin vea el bloqueo antes de pulsar Guardar.
 */
function ShiftEffectiveBadge({ row }: { row: RowState }) {
  const isDiurnoLike =
    row.shiftType === 'diurno_completo' || row.shiftType === 'servicios_transfusionales'
  const eff = effectiveShiftHours(row.startTime, row.endTime, row.isOvernight, row.shiftType)
  const tooShort = isDiurnoLike && eff < MIN_EFFECTIVE_HOURS_DIURNO
  const cls = tooShort
    ? 'text-destructive border-destructive/40 bg-destructive/10'
    : 'text-muted-foreground border-border bg-muted/40'
  return (
    <span
      className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-mono ${cls}`}
      title={
        isDiurnoLike
          ? 'Horas efectivas (descuenta 1h de almuerzo en turnos diurnos)'
          : 'Horas efectivas del turno'
      }
    >
      {eff}h
    </span>
  )
}
