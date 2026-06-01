'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Calendar, Copy } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  duplicateWeekSedeShifts,
  getWeeksWithShifts,
  getWeekShiftsForDuplicate,
  type StaffListItem,
  type WeekShiftsForDuplicate,
  type WeekWithShifts,
} from '@/features/sede/actions/sede-shift-actions'
import {
  MODALITY_BY_SHIFT_TYPE,
  SEDE_MODALITY_LABELS,
  SEDE_SHIFT_DEFAULTS,
  SHIFT_TYPE_LABELS,
  type ShiftType,
  type SedeModality,
} from '@/features/sede/lib/shift-defaults'
import {
  mapDateToTargetWeek,
  weekDaysFromMonday,
} from '@/features/sede/lib/week-duplicate-mapping'
import type {
  DayAssignmentItem,
  DuplicateWeekDayInput,
} from '@/features/sede/schemas/sede-shift-schemas'

interface DuplicateWeekDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Semana actualmente visible (default destino). */
  currentWeekStart: string
  staffList: StaffListItem[]
  onSaved: () => void
}

type Step = 'source' | 'destination' | 'preview'

const WEEK_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/**
 * Estado editable por celda en la preview: tiene una asignación derivada del
 * origen + flags de inclusión y resolución de colisión.
 */
interface CellState {
  staffId: string
  staffLabel: string
  staffProfile: string
  /** Fecha destino (ya mapeada L→L, M→M...). */
  targetDate: string
  /** Días de la semana origen del que viene (informativo, para la UI). */
  sourceDate: string
  /** Modalidad derivada del shiftType. */
  modality: SedeModality
  shiftType: ShiftType
  startTime: string
  endTime: string
  isOvernight: boolean
  notes: string
  /** Si la celda colisiona con el destino, qué shiftType existía. Null si no
   *  hay colisión. */
  collisionExistingType: string | null
  /** Decisión del admin para esta celda. `include` = persistir como upsert
   *  (sobrescribir destino si colisiona). `skip` = no incluir (preserva
   *  destino si colisiona; o simplemente no programar si no colisiona). */
  decision: 'include' | 'skip'
}

function calcMondayOf(iso: string): string {
  const dt = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(dt.getTime())) return iso
  const dow = dt.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  const lun = new Date(dt)
  lun.setDate(dt.getDate() + offset)
  return lun.toISOString().slice(0, 10)
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  return `${fmt(start)} – ${fmt(end)}`
}

function dayLabelFor(iso: string): string {
  const dt = new Date(`${iso}T00:00:00`)
  const dow = dt.getDay()
  const idx = dow === 0 ? 6 : dow - 1
  return WEEK_LABELS[idx]
}

/**
 * Diálogo de duplicar la programación de una semana origen (pasada) a una
 * semana destino. Flujo de 3 pasos:
 *  1) `source`: elegir cuál semana copiar de las semanas con turnos del año.
 *  2) `destination`: elegir la semana destino (default = semana visible).
 *  3) `preview`: revisar celda por celda, ajustar horarios, resolver
 *     colisiones (skip|overwrite) y confirmar.
 */
export function DuplicateWeekDialog({
  open,
  onOpenChange,
  currentWeekStart,
  staffList,
  onSaved,
}: DuplicateWeekDialogProps) {
  const [step, setStep] = useState<Step>('source')

  // Step 1 — origen.
  const [weeks, setWeeks] = useState<WeekWithShifts[]>([])
  const [loadingWeeks, setLoadingWeeks] = useState(false)
  const [sourceWeekStart, setSourceWeekStart] = useState<string | null>(null)

  // Step 2 — destino.
  const [targetWeekStart, setTargetWeekStart] = useState<string>(currentWeekStart)
  const [destinationInput, setDestinationInput] = useState<string>(currentWeekStart)

  // Step 3 — preview.
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewData, setPreviewData] = useState<WeekShiftsForDuplicate | null>(null)
  const [cells, setCells] = useState<CellState[]>([])

  // Estado del guardado.
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const staffById = useMemo(
    () => new Map(staffList.map((s) => [s.id, s])),
    [staffList],
  )

  // Reset al cerrar.
  useEffect(() => {
    if (!open) {
      setStep('source')
      setSourceWeekStart(null)
      setTargetWeekStart(currentWeekStart)
      setDestinationInput(currentWeekStart)
      setPreviewData(null)
      setCells([])
      setError(null)
      setBusy(false)
    }
  }, [open, currentWeekStart])

  // Carga lista de semanas al entrar al paso 1.
  useEffect(() => {
    if (!open || step !== 'source') return
    let cancelled = false
    async function load() {
      setLoadingWeeks(true)
      try {
        const res = await getWeeksWithShifts(12)
        if (!cancelled) setWeeks(res)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error cargando semanas')
        }
      } finally {
        if (!cancelled) setLoadingWeeks(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [open, step])

  async function loadPreview(src: string, tgt: string) {
    setLoadingPreview(true)
    setError(null)
    try {
      const res = await getWeekShiftsForDuplicate(src, tgt)
      setPreviewData(res)
      // Construir cells a partir del origen mapeado al destino.
      const collisionsByCell = new Map<string, string>()
      for (const c of res.destinationCollisions) {
        collisionsByCell.set(`${c.staffId}|${c.targetDate}`, c.existingShiftType)
      }
      const newCells: CellState[] = res.sourceShifts.map((s) => {
        const targetDate = mapDateToTargetWeek(s.shiftDate, src, tgt)
        const staff = staffById.get(s.staffId)
        const staffLabel = staff
          ? `${staff.lastName}, ${staff.firstName}`
          : `${s.lastName}, ${s.firstName}`
        const staffProfile = staff?.staffProfile ?? s.staffProfile
        const collisionExistingType =
          collisionsByCell.get(`${s.staffId}|${targetDate}`) ?? null
        return {
          staffId: s.staffId,
          staffLabel,
          staffProfile,
          targetDate,
          sourceDate: s.shiftDate,
          modality: MODALITY_BY_SHIFT_TYPE[s.shiftType],
          shiftType: s.shiftType,
          startTime: s.startTime,
          endTime: s.endTime,
          isOvernight: s.isOvernight,
          notes: s.notes ?? '',
          collisionExistingType,
          // Default: si hay colisión, asumimos "include" (overwrite) para no
          // perder el flujo natural — el admin elige skip si quiere preservar
          // el destino.
          decision: 'include',
        }
      })
      // Orden estable: por fecha destino y luego por nombre.
      newCells.sort((a, b) =>
        a.targetDate === b.targetDate
          ? a.staffLabel.localeCompare(b.staffLabel)
          : a.targetDate < b.targetDate
            ? -1
            : 1,
      )
      setCells(newCells)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando preview')
    } finally {
      setLoadingPreview(false)
    }
  }

  function handleSelectSource(weekStart: string) {
    setSourceWeekStart(weekStart)
    setStep('destination')
  }

  function handleConfirmDestination() {
    // Snap al lunes de la fecha digitada.
    const monday = calcMondayOf(destinationInput)
    setTargetWeekStart(monday)
    setStep('preview')
    if (sourceWeekStart) {
      void loadPreview(sourceWeekStart, monday)
    }
  }

  function updateCell(idx: number, patch: Partial<CellState>) {
    setCells((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }

  // Agrupa cells incluidas por (date, modality) para construir el payload.
  function buildPerDay(): DuplicateWeekDayInput[] {
    const buckets = new Map<string, DayAssignmentItem[]>()
    for (const c of cells) {
      if (c.decision !== 'include') continue
      const key = `${c.targetDate}|${c.modality}`
      const arr = buckets.get(key) ?? []
      const defaults = SEDE_SHIFT_DEFAULTS[c.shiftType]
      const customTimes =
        c.startTime !== defaults.startTime ||
        c.endTime !== defaults.endTime ||
        c.isOvernight !== defaults.isOvernight
      arr.push({
        staffId: c.staffId,
        shiftType: c.shiftType,
        startTime: customTimes ? c.startTime : undefined,
        endTime: customTimes ? c.endTime : undefined,
        isOvernight: customTimes ? c.isOvernight : undefined,
        notes: c.notes.trim() ? c.notes.trim() : undefined,
      })
      buckets.set(key, arr)
    }
    const out: DuplicateWeekDayInput[] = []
    for (const [key, assignments] of buckets.entries()) {
      const [date, modality] = key.split('|') as [string, SedeModality]
      out.push({ date, modality, assignments })
    }
    return out
  }

  async function handleSave() {
    if (busy || !sourceWeekStart) return
    setError(null)
    const perDay = buildPerDay()
    if (perDay.length === 0) {
      setError(
        'No hay celdas marcadas para duplicar. Marca al menos una asignación o cancela.',
      )
      return
    }
    setBusy(true)
    try {
      const res = await duplicateWeekSedeShifts({
        sourceWeekStart,
        targetWeekStart,
        perDay,
      })
      toast.success(
        `Duplicación: ${res.upserted} turno${res.upserted === 1 ? '' : 's'} en ${
          res.daysProcessed
        } bucket${res.daysProcessed === 1 ? '' : 's'}` +
          (res.removed > 0
            ? `, ${res.removed} removido${res.removed === 1 ? '' : 's'}`
            : ''),
      )
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al duplicar')
    } finally {
      setBusy(false)
    }
  }

  // Resumen para el footer del paso 3.
  const summary = useMemo(() => {
    let includeCount = 0
    let skipCount = 0
    let collisionCount = 0
    for (const c of cells) {
      if (c.decision === 'include') includeCount += 1
      else skipCount += 1
      if (c.collisionExistingType) collisionCount += 1
    }
    return { includeCount, skipCount, collisionCount }
  }, [cells])

  // Agrupa cells por fecha destino para mostrar la preview ordenada por día.
  const cellsByTargetDate = useMemo(() => {
    const map = new Map<string, Array<{ cell: CellState; idx: number }>>()
    cells.forEach((cell, idx) => {
      const arr = map.get(cell.targetDate) ?? []
      arr.push({ cell, idx })
      map.set(cell.targetDate, arr)
    })
    return map
  }, [cells])

  const targetDays = useMemo(
    () => weekDaysFromMonday(targetWeekStart),
    [targetWeekStart],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto overflow-x-hidden"
        style={{ maxWidth: 'min(56rem, calc(100vw - 2rem))', width: '100%' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="size-4 shrink-0" />
            Duplicar semana de programación
          </DialogTitle>
          <DialogDescription>
            {step === 'source' && 'Elige una semana pasada con turnos para copiarla.'}
            {step === 'destination' &&
              'Elige la semana destino. Por defecto es la semana visible.'}
            {step === 'preview' &&
              'Revisa cada asignación, resuelve colisiones y confirma. Los días origen mapean 1:1 al mismo día de la semana destino.'}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1 — Source */}
        {step === 'source' && (
          <div className="space-y-2">
            {loadingWeeks ? (
              <p className="text-sm text-muted-foreground">Cargando semanas con turnos...</p>
            ) : weeks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay semanas con turnos en el último año.
              </p>
            ) : (
              <div className="max-h-[60vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {weeks.map((w) => (
                  <button
                    key={w.weekStart}
                    type="button"
                    onClick={() => handleSelectSource(w.weekStart)}
                    className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="size-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">
                          Semana del lunes {w.weekStart}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatWeekRange(w.weekStart)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-mono text-muted-foreground">
                        {w.shiftCount} turno{w.shiftCount === 1 ? '' : 's'}
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 — Destination */}
        {step === 'destination' && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <strong>Origen:</strong> semana del lunes {sourceWeekStart}{' '}
              {sourceWeekStart && (
                <span className="text-muted-foreground">
                  ({formatWeekRange(sourceWeekStart)})
                </span>
              )}
            </div>

            <div>
              <Label htmlFor="duplicate-target" className="text-xs">
                Fecha destino (cualquier día de la semana destino)
              </Label>
              <Input
                id="duplicate-target"
                type="date"
                value={destinationInput}
                onChange={(e) => setDestinationInput(e.target.value)}
                className="h-9"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Se ajustará al lunes de esa semana:{' '}
                <strong>{calcMondayOf(destinationInput)}</strong> (
                {formatWeekRange(calcMondayOf(destinationInput))}).
              </p>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep('source')}>
                <ArrowLeft className="size-4" />
                Atrás
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirmDestination}>
                  Cargar preview
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 — Preview */}
        {step === 'preview' && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
              <div>
                <strong>Origen:</strong> {sourceWeekStart} ·{' '}
                <strong>Destino:</strong> {targetWeekStart}
              </div>
              {previewData && (
                <div className="mt-1 text-muted-foreground">
                  {previewData.sourceShifts.length} turno
                  {previewData.sourceShifts.length === 1 ? '' : 's'} en origen ·{' '}
                  {summary.collisionCount} colisión
                  {summary.collisionCount === 1 ? '' : 'es'} detectada
                  {summary.collisionCount === 1 ? '' : 's'} en destino
                </div>
              )}
            </div>

            {loadingPreview ? (
              <p className="text-sm text-muted-foreground">Cargando preview...</p>
            ) : cells.length === 0 ? (
              <p className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                La semana origen no tiene turnos en tu área. Vuelve atrás y elige otra.
              </p>
            ) : (
              <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                {targetDays.map((targetDate) => {
                  const cellsOfDay = cellsByTargetDate.get(targetDate) ?? []
                  if (cellsOfDay.length === 0) return null
                  return (
                    <div
                      key={targetDate}
                      className="rounded-lg border border-border"
                    >
                      <div className="border-b border-border bg-muted/30 px-3 py-2 text-xs font-medium">
                        {dayLabelFor(targetDate)} {targetDate} · {cellsOfDay.length}{' '}
                        asignación{cellsOfDay.length === 1 ? '' : 'es'}
                      </div>
                      <div className="divide-y divide-border">
                        {cellsOfDay.map(({ cell, idx }) => (
                          <PreviewCellRow
                            key={`${cell.staffId}-${cell.targetDate}`}
                            cell={cell}
                            onChange={(patch) => updateCell(idx, patch)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {error && (
              <div className="whitespace-pre-line rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex flex-wrap justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('destination')}
                disabled={busy}
              >
                <ArrowLeft className="size-4" />
                Atrás
              </Button>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{summary.includeCount} para guardar</span>
                <span>·</span>
                <span>{summary.skipCount} omitido{summary.skipCount === 1 ? '' : 's'}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={busy}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={busy || loadingPreview || cells.length === 0}
                >
                  {busy ? 'Guardando...' : `Confirmar y guardar`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface PreviewCellRowProps {
  cell: CellState
  onChange: (patch: Partial<CellState>) => void
}

/**
 * Una fila de la preview: staff + fecha destino + asignación derivada +
 * resolución de colisión (si la hay) + edición opcional de horario.
 */
function PreviewCellRow({ cell, onChange }: PreviewCellRowProps) {
  const [expanded, setExpanded] = useState(false)
  const include = cell.decision === 'include'
  const hasCollision = cell.collisionExistingType !== null

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          checked={include}
          onChange={(e) =>
            onChange({ decision: e.target.checked ? 'include' : 'skip' })
          }
          className="h-4 w-4 shrink-0 rounded border-input"
          aria-label="Incluir esta asignación"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{cell.staffLabel}</div>
          <div className="truncate text-xs text-muted-foreground">
            {cell.staffProfile} · origen {cell.sourceDate} →{' '}
            {SHIFT_TYPE_LABELS[cell.shiftType]} · {SEDE_MODALITY_LABELS[cell.modality]}
          </div>
        </div>
        <span className="shrink-0 rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs text-muted-foreground">
          {cell.startTime}–{cell.endTime}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setExpanded((v) => !v)}
          className="h-7 text-xs"
        >
          {expanded ? 'Ocultar' : 'Editar'}
        </Button>
      </div>

      {hasCollision && (
        <div className="ml-6 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs">
          <span className="font-medium text-amber-700 dark:text-amber-400">
            Colisión:
          </span>
          <span className="text-amber-700 dark:text-amber-300">
            el destino ya tiene un turno {cell.collisionExistingType}
          </span>
          <Select
            value={include ? 'overwrite' : 'skip'}
            onValueChange={(v) =>
              onChange({ decision: v === 'skip' ? 'skip' : 'include' })
            }
          >
            <SelectTrigger className="h-7 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skip">Mantener destino</SelectItem>
              <SelectItem value="overwrite">Sobrescribir con origen</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {expanded && include && (
        <div className="ml-6 grid grid-cols-1 gap-2 pt-1 sm:grid-cols-4">
          <div>
            <Label className="text-xs">Inicio</Label>
            <Input
              type="time"
              value={cell.startTime}
              onChange={(e) => onChange({ startTime: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Fin</Label>
            <Input
              type="time"
              value={cell.endTime}
              onChange={(e) => onChange({ endTime: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              checked={cell.isOvernight}
              onChange={(e) => onChange({ isOvernight: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            <Label className="cursor-pointer text-xs">Pernocta</Label>
          </div>
          <div>
            <Label className="text-xs">Notas</Label>
            <Input
              type="text"
              value={cell.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              className="h-8 text-xs"
              placeholder="Opcional"
            />
          </div>
        </div>
      )}
    </div>
  )
}
