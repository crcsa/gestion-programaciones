'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { SedeShiftRow } from '@/features/sede/actions/sede-shift-actions'

// ---- Constants ------------------------------------------------------------

const SHIFT_TYPE_LABELS: Record<string, string> = {
  diurno_completo: 'Diurno completo',
  noche: 'Noche',
  posturno: 'Posturno',
}

const PROFILE_LABELS: Record<string, string> = {
  bacteriologo: 'Bacteriologo',
  tecnico: 'Tecnico',
  medico: 'Medico',
  auxiliar: 'Auxiliar',
}

// ---- Helpers --------------------------------------------------------------

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('es-CO', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
}

// ---- Props ----------------------------------------------------------------

interface SedeShiftTableProps {
  rows: SedeShiftRow[]
  onEdit: (row: SedeShiftRow) => void
  onDelete: (id: string) => void
}

// ---- Component ------------------------------------------------------------

export function SedeShiftTable({ rows, onEdit, onDelete }: SedeShiftTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No hay turnos registrados para esta semana.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Colaborador</TableHead>
          <TableHead>Perfil</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Hora inicio</TableHead>
          <TableHead>Hora fin</TableHead>
          <TableHead>Horas</TableHead>
          <TableHead>Pernocta</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">
              {row.lastName}, {row.firstName}
            </TableCell>
            <TableCell>{PROFILE_LABELS[row.staffProfile] ?? row.staffProfile}</TableCell>
            <TableCell>{formatDate(row.shiftDate)}</TableCell>
            <TableCell>{SHIFT_TYPE_LABELS[row.shiftType] ?? row.shiftType}</TableCell>
            <TableCell>{row.startTime}</TableCell>
            <TableCell>{row.endTime}</TableCell>
            <TableCell
              title={
                row.shiftType === 'diurno_completo'
                  ? 'Horas efectivas (descuenta 1h de almuerzo en Diurno completo)'
                  : 'Horas efectivas del turno'
              }
            >
              {row.totalHours}h
            </TableCell>
            <TableCell>{row.isOvernight ? 'Si' : 'No'}</TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onEdit(row)}
                  aria-label={`Editar turno de ${row.lastName}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onDelete(row.id)}
                  aria-label={`Eliminar turno de ${row.lastName}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
