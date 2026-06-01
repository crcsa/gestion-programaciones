'use client'

import { useMemo, type Dispatch, type SetStateAction } from 'react'
import { Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  SEDE_SHIFT_DEFAULTS,
  SHIFT_TYPE_LABELS,
  SEDE_MODALITY_LABELS,
  effectiveShiftHours,
  MIN_EFFECTIVE_HOURS_DIURNO,
  type ShiftType,
  type SedeModality,
} from '@/features/sede/lib/shift-defaults'
import { STAFF_PROFILE_LABELS, type StaffProfile } from '@/features/staff/lib/constants'
import type { StaffListItem } from '@/features/sede/actions/sede-shift-actions'

export interface RowState {
  selected: boolean
  shiftType: ShiftType
  startTime: string
  endTime: string
  isOvernight: boolean
  notes: string
  /** True cuando el usuario tocó manualmente alguno de los horarios. Si está
   *  en false, se vuelven a aplicar los defaults del tipo de turno cuando este
   *  cambia. */
  customTimes: boolean
}

export function defaultRow(shiftType: ShiftType = 'diurno_completo'): RowState {
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

export interface AssignmentRowsEditorProps {
  /** Map keyed por staffId con el estado editable de cada fila. */
  rows: Map<string, RowState>
  setRows: Dispatch<SetStateAction<Map<string, RowState>>>
  staffList: StaffListItem[]
  /** Staff con turno previo de la OTRA modalidad (deshabilitados con nota).
   *  El caller decide cómo calcularlo (por día o agregado en rango). */
  otherModalityByStaff: Map<string, SedeModality>
  modality: SedeModality
  expandedStaffId: string | null
  setExpandedStaffId: Dispatch<SetStateAction<string | null>>
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  /** Tipo por defecto al re-hidratar filas sin estado previo. */
  fallbackType: ShiftType
  /** Si false, oculta el botón "Diurno a seleccionados" (modalidad servicios). */
  showDiurnoQuickAction?: boolean
}

/**
 * Grilla editable de asignaciones de turno para un día (o varios días con la
 * misma config en flujos rango / duplicar). Encapsula el toolbar de búsqueda,
 * acciones masivas (Diurno / Desmarcar), la lista filtrada y el editor por
 * fila (tipo de turno, horario, pernocta, notas). El estado vive en el caller
 * para que el guardado pueda decidir cómo construir el payload.
 */
export function AssignmentRowsEditor({
  rows,
  setRows,
  staffList,
  otherModalityByStaff,
  modality,
  expandedStaffId,
  setExpandedStaffId,
  search,
  setSearch,
  fallbackType,
  showDiurnoQuickAction = true,
}: AssignmentRowsEditorProps) {
  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return staffList
    return staffList.filter((s) =>
      `${s.firstName} ${s.lastName} ${s.staffProfile}`.toLowerCase().includes(q),
    )
  }, [staffList, search])

  const selectedCount = useMemo(() => {
    let n = 0
    for (const s of staffList) {
      if (rows.get(s.id)?.selected) n++
    }
    return n
  }, [rows, staffList])

  function updateRow(staffId: string, patch: Partial<RowState>) {
    setRows((prev) => {
      const current = prev.get(staffId) ?? defaultRow(fallbackType)
      const next = new Map(prev)
      next.set(staffId, { ...current, ...patch })
      return next
    })
  }

  function handleShiftTypeChange(staffId: string, shiftType: ShiftType) {
    setRows((prev) => {
      const current = prev.get(staffId) ?? defaultRow(fallbackType)
      const next = new Map(prev)
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
        const current = next.get(s.id) ?? defaultRow(fallbackType)
        if (!current.selected) continue
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
        const current = next.get(s.id) ?? defaultRow(fallbackType)
        next.set(s.id, { ...current, selected: false })
      }
      return next
    })
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar por nombre o perfil..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 flex-1 min-w-0"
        />
        <div className="flex items-center gap-2">
          {showDiurnoQuickAction && modality === 'sede' && (
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
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clearAllVisible}
            className="gap-1"
          >
            <X className="size-3.5" />
            Desmarcar
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Mostrando {filteredStaff.length} de {staffList.length} colaboradores activos ·{' '}
        {selectedCount} seleccionado{selectedCount === 1 ? '' : 's'}.
      </p>

      <div className="rounded-lg border border-border divide-y divide-border max-h-[420px] overflow-y-auto">
        {filteredStaff.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Sin coincidencias para la búsqueda.
          </p>
        ) : (
          filteredStaff.map((s) => {
            const row = rows.get(s.id) ?? defaultRow(fallbackType)
            const isExpanded = expandedStaffId === s.id
            const blockedBy = otherModalityByStaff.get(s.id)
            return (
              <div key={s.id} className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    id={`chk-${s.id}`}
                    checked={row.selected && !blockedBy}
                    disabled={!!blockedBy}
                    onChange={(e) => updateRow(s.id, { selected: e.target.checked })}
                    className="h-4 w-4 rounded border-input shrink-0 disabled:opacity-50"
                  />
                  <Label
                    htmlFor={`chk-${s.id}`}
                    className={`flex-1 min-w-0 text-sm font-normal ${blockedBy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  >
                    <span className="font-medium">
                      {s.lastName}, {s.firstName}
                    </span>
                    <span className="text-muted-foreground ml-1.5 text-xs">
                      ({STAFF_PROFILE_LABELS[s.staffProfile as StaffProfile] ?? s.staffProfile})
                    </span>
                    {blockedBy && (
                      <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400">
                        · Ya en {SEDE_MODALITY_LABELS[blockedBy]} ese día
                      </span>
                    )}
                  </Label>
                  {row.selected && !blockedBy && (
                    <>
                      {modality === 'sede' ? (
                        <div className="w-40 shrink-0">
                          <Select
                            value={row.shiftType}
                            onValueChange={(v) =>
                              handleShiftTypeChange(s.id, (v ?? fallbackType) as ShiftType)
                            }
                          >
                            <SelectTrigger className="h-8 w-full text-xs">
                              <SelectValue>{SHIFT_TYPE_LABELS[row.shiftType]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="diurno_completo">
                                {SHIFT_TYPE_LABELS.diurno_completo}
                              </SelectItem>
                              <SelectItem value="noche">{SHIFT_TYPE_LABELS.noche}</SelectItem>
                              <SelectItem value="posturno">
                                {SHIFT_TYPE_LABELS.posturno}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <span className="w-40 shrink-0 text-xs text-muted-foreground">
                          {SHIFT_TYPE_LABELS.servicios_transfusionales}
                        </span>
                      )}
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
                      <Label
                        htmlFor={`overnight-${s.id}`}
                        className="text-xs cursor-pointer"
                      >
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
    </>
  )
}

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
