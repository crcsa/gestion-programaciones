'use client'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Download } from 'lucide-react'
import { exportToExcel } from '@/lib/excel/export-utils'
import type { PersonalReportRow } from '../actions/report-actions'

interface PersonalReportTableProps {
  rows: PersonalReportRow[]
}

const PROFILE_LABELS: Record<string, string> = {
  bacteriologo: 'Bacteriologo',
  tecnico: 'Tecnico',
  medico: 'Medico',
  auxiliar: 'Auxiliar',
  coordinador: 'Coordinador',
}

function handleExport(rows: PersonalReportRow[]) {
  const exportRows = rows.map((r) => ({
    Nombre: `${r.lastName}, ${r.firstName}`,
    Perfil: PROFILE_LABELS[r.staffProfile] ?? r.staffProfile,
    'Horas trabajadas': r.totalWorkedHours,
    'Horas extras': r.totalExtraHours,
    Domingos: r.totalSundayCount,
    Pernoctas: r.totalOvernightCount,
    Campanas: r.totalCampaigns,
  }))
  exportToExcel(exportRows, 'Personal', 'reporte-personal')
}

export function PersonalReportTable({ rows }: PersonalReportTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        No hay datos de personal para el rango seleccionado.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => handleExport(rows)}>
          <Download className="mr-2 h-4 w-4" />
          Exportar Excel
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead className="text-right">Horas trabajadas</TableHead>
              <TableHead className="text-right">Horas extras</TableHead>
              <TableHead className="text-right">Domingos</TableHead>
              <TableHead className="text-right">Pernoctas</TableHead>
              <TableHead className="text-right">Campanas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.staffId}>
                <TableCell className="font-medium">
                  {row.lastName}, {row.firstName}
                </TableCell>
                <TableCell>{PROFILE_LABELS[row.staffProfile] ?? row.staffProfile}</TableCell>
                <TableCell className="text-right">{row.totalWorkedHours}h</TableCell>
                <TableCell className="text-right">
                  {row.totalExtraHours > 0 ? (
                    <span className="text-yellow-600 dark:text-yellow-400">+{row.totalExtraHours}h</span>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-right">{row.totalSundayCount}</TableCell>
                <TableCell className="text-right">{row.totalOvernightCount}</TableCell>
                <TableCell className="text-right">{row.totalCampaigns}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
