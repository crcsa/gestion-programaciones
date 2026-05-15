'use client'

import { useMemo, useRef, useState, useCallback, useTransition } from 'react'
import { CalendarRange, Calendar, ListChecks, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
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
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { WeekSelector } from '@/features/availability/components/week-selector'
import { SedeShiftForm } from './sede-shift-form'
import { SedeShiftTable } from './sede-shift-table'
import { WeeklyShiftsCalendar } from './weekly-shifts-calendar'
import { MonthlyShiftsOverview } from './monthly-shifts-overview'
import {
  getWeeklySedeShifts,
  createSedeShift,
  updateSedeShift,
  deleteSedeShift,
} from '@/features/sede/actions/sede-shift-actions'
import { validateSedeShift } from '@/features/sede/actions/sede-shift-validation'
import { SedeWarningsDialog, type StaffWarningGroup } from './sede-warnings-dialog'
import type { ValidationResult } from '@/features/assignments/lib/validation-engine'
import type {
  SedeShiftRow,
  StaffListItem,
  DayShiftCount,
} from '@/features/sede/actions/sede-shift-actions'
import type { CreateSedeShiftInput } from '@/features/sede/schemas/sede-shift-schemas'
import type { Role } from '@/types/roles'

// ---- Props ----------------------------------------------------------------

interface SedeShiftsClientProps {
  initialData: SedeShiftRow[]
  initialWeekStart: string
  initialMonthlyCounts: DayShiftCount[]
  initialYear: number
  initialMonth: number
  staffList: StaffListItem[]
  currentRole: Role | null
}

// ---- Component ------------------------------------------------------------

export function SedeShiftsClient({
  initialData,
  initialWeekStart,
  initialMonthlyCounts,
  initialYear,
  initialMonth,
  staffList,
  currentRole,
}: SedeShiftsClientProps) {
  const [rows, setRows] = useState<SedeShiftRow[]>(initialData)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<SedeShiftRow | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingWarnings, setPendingWarnings] = useState<{
    warnings: ValidationResult[]
    staffName: string
  } | null>(null)
  const pendingResolveRef = useRef<((v: boolean) => void) | null>(null)

  // Filtros para tab "Detalle"
  const [search, setSearch] = useState('')
  const [perfil, setPerfil] = useState<string>('todos')
  const [shiftTypeFilter, setShiftTypeFilter] = useState<string>('todos')

  const canManage = currentRole === 'admin' || currentRole === 'admin_area'

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.firstName} ${r.lastName}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (perfil !== 'todos' && r.staffProfile !== perfil) return false
      if (shiftTypeFilter !== 'todos' && r.shiftType !== shiftTypeFilter) return false
      return true
    })
  }, [rows, search, perfil, shiftTypeFilter])

  const hasActiveFilters = search.trim() !== '' || perfil !== 'todos' || shiftTypeFilter !== 'todos'

  function clearFilters() {
    setSearch('')
    setPerfil('todos')
    setShiftTypeFilter('todos')
  }

  const refreshData = useCallback(() => {
    startTransition(async () => {
      try {
        const freshData = await getWeeklySedeShifts(initialWeekStart)
        setRows(freshData)
      } catch {
        toast.error('Error al refrescar los turnos')
      }
    })
  }, [initialWeekStart])

  async function runValidationAndConfirm(
    data: CreateSedeShiftInput,
    excludeShiftId?: string,
  ): Promise<boolean> {
    try {
      const v = await validateSedeShift({
        staffId: data.staffId,
        shiftDate: data.shiftDate,
        startTime: data.startTime,
        endTime: data.endTime,
        isOvernight: data.isOvernight,
        excludeShiftId,
      })
      if (v.hasBlock) {
        const msg = v.results
          .filter((r) => r.severity === 'block')
          .map((r) => `• ${r.message}`)
          .join('\n')
        toast.error(`No se puede crear el turno:\n${msg}`)
        return false
      }
      if (v.hasWarn) {
        const staff = staffList.find((s) => s.id === data.staffId)
        const staffName = staff ? `${staff.lastName}, ${staff.firstName}` : 'colaborador'
        const warnings = v.results.filter((r) => r.severity === 'warn')
        return new Promise<boolean>((resolve) => {
          pendingResolveRef.current = resolve
          setPendingWarnings({ warnings, staffName })
        })
      }
      return true
    } catch (err) {
      console.error('[validateSedeShift] error:', err)
      return true
    }
  }

  function handleWarningCancel() {
    setPendingWarnings(null)
    if (pendingResolveRef.current) {
      pendingResolveRef.current(false)
      pendingResolveRef.current = null
    }
  }

  function handleWarningConfirm() {
    setPendingWarnings(null)
    if (pendingResolveRef.current) {
      pendingResolveRef.current(true)
      pendingResolveRef.current = null
    }
  }

  // Sin `useCallback`: el React Compiler memoiza automáticamente y la versión
  // manual no pudo preservar memoización (depende de `runValidationAndConfirm`
  // que no es estable).
  const handleCreate = async (data: CreateSedeShiftInput) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    const proceed = await runValidationAndConfirm(data)
    if (!proceed) {
      setIsSubmitting(false)
      return
    }
    try {
      await createSedeShift(data)
      toast.success('Turno creado exitosamente')
      setDialogOpen(false)
      setEditingRow(null)
      refreshData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al crear el turno'
      toast.error(message)
      setIsSubmitting(false)
      return
    }
    setIsSubmitting(false)
  }

  const handleUpdate = async (data: CreateSedeShiftInput) => {
    if (!editingRow || isSubmitting) return
    setIsSubmitting(true)
    const proceed = await runValidationAndConfirm(data, editingRow.id)
    if (!proceed) {
      setIsSubmitting(false)
      return
    }
    try {
      await updateSedeShift(editingRow.id, {
        shiftType: data.shiftType,
        startTime: data.startTime,
        endTime: data.endTime,
        isOvernight: data.isOvernight,
        notes: data.notes,
      })
      toast.success('Turno actualizado exitosamente')
      setDialogOpen(false)
      setEditingRow(null)
      refreshData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al actualizar el turno'
      toast.error(message)
      setIsSubmitting(false)
      return
    }
    setIsSubmitting(false)
  }

  const handleEdit = useCallback((row: SedeShiftRow) => {
    setEditingRow(row)
    setDialogOpen(true)
  }, [])

  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = window.confirm('¿Está seguro de eliminar este turno?')
      if (!confirmed) return

      try {
        await deleteSedeShift(id)
        toast.success('Turno eliminado exitosamente')
        refreshData()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error al eliminar el turno'
        toast.error(message)
      }
    },
    [refreshData],
  )

  const handleOpenCreate = useCallback(() => {
    setEditingRow(null)
    setDialogOpen(true)
  }, [])

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false)
    setEditingRow(null)
  }, [])

  const editDefaults = editingRow
    ? {
        staffId: editingRow.staffId,
        shiftDate: editingRow.shiftDate,
        shiftType: editingRow.shiftType,
        startTime: editingRow.startTime,
        endTime: editingRow.endTime,
        isOvernight: editingRow.isOvernight,
        notes: editingRow.notes ?? undefined,
      }
    : undefined

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Turnos en Sede</h1>
        <div className="flex items-center gap-2">
          <WeekSelector weekStart={initialWeekStart} paramName="semana" />
        </div>
      </div>

      <Tabs defaultValue="weekly" className="flex-col">
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="h-9 w-fit p-1">
            <TabsTrigger value="weekly" className="h-7 flex-none gap-1.5 px-3">
              <Calendar className="size-3.5" aria-hidden />
              Programación semanal
            </TabsTrigger>
            <TabsTrigger value="monthly" className="h-7 flex-none gap-1.5 px-3">
              <CalendarRange className="size-3.5" aria-hidden />
              Capacidad mensual
            </TabsTrigger>
            <TabsTrigger value="detail" className="h-7 flex-none gap-1.5 px-3">
              <ListChecks className="size-3.5" aria-hidden />
              Detalle por turno
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="weekly" className="pt-4">
          {isPending ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : (
            <WeeklyShiftsCalendar
              shifts={rows}
              staffList={staffList}
              weekStart={initialWeekStart}
              onChanged={refreshData}
            />
          )}
        </TabsContent>

        <TabsContent value="monthly" className="pt-4">
          <MonthlyShiftsOverview
            staffList={staffList}
            initialCounts={initialMonthlyCounts}
            initialYear={initialYear}
            initialMonth={initialMonth}
            onChanged={refreshData}
          />
        </TabsContent>

        <TabsContent value="detail" className="space-y-4 pt-4">
          <div className="flex items-center justify-end gap-2">
            {canManage && (
              <Button onClick={handleOpenCreate} size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Nuevo turno (individual)
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
            <div className="flex-1 min-w-0 sm:min-w-48">
              <Label htmlFor="shifts-search" className="mb-1.5 text-xs">
                Buscar
              </Label>
              <Input
                id="shifts-search"
                placeholder="Nombre o apellido..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="w-full sm:w-44">
              <Label htmlFor="shifts-perfil" className="mb-1.5 text-xs">
                Perfil
              </Label>
              <Select value={perfil} onValueChange={(v) => setPerfil(v ?? 'todos')}>
                <SelectTrigger id="shifts-perfil" className="h-9 w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="bacteriologo">Bacteriólogo</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                  <SelectItem value="medico">Médico</SelectItem>
                  <SelectItem value="auxiliar">Auxiliar</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-44">
              <Label htmlFor="shifts-type" className="mb-1.5 text-xs">
                Tipo de turno
              </Label>
              <Select value={shiftTypeFilter} onValueChange={(v) => setShiftTypeFilter(v ?? 'todos')}>
                <SelectTrigger id="shifts-type" className="h-9 w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="diurno_completo">Diurno Completo</SelectItem>
                  <SelectItem value="noche">Noche</SelectItem>
                  <SelectItem value="posturno">Posturno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-9 self-end rounded-md border border-border bg-background px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Mostrando {filteredRows.length} de {rows.length} turnos.
          </p>

          {isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <SedeShiftTable rows={filteredRows} onEdit={handleEdit} onDelete={handleDelete} />
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) handleDialogClose()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRow ? 'Editar Turno' : 'Nuevo Turno'}</DialogTitle>
          </DialogHeader>
          <SedeShiftForm
            key={editingRow?.id ?? 'new'}
            staffList={staffList}
            weekShifts={rows}
            editingShiftId={editingRow?.id}
            defaultValues={editDefaults}
            onSubmit={editingRow ? handleUpdate : handleCreate}
            isLoading={isSubmitting}
            weekStart={initialWeekStart}
          />
        </DialogContent>
      </Dialog>

      <SedeWarningsDialog
        open={!!pendingWarnings}
        groups={
          pendingWarnings
            ? ([
                { staffName: pendingWarnings.staffName, warnings: pendingWarnings.warnings },
              ] as StaffWarningGroup[])
            : []
        }
        title="Confirmar turno con advertencias"
        confirmLabel="Crear turno de todos modos"
        onConfirm={handleWarningConfirm}
        onCancel={handleWarningCancel}
      />
    </div>
  )
}
