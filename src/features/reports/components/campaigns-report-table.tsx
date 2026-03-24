'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import type { CampaignReportRow } from '../actions/report-actions'

interface CampaignsReportTableProps {
  rows: CampaignReportRow[]
}

const STATUS_VARIANTS: Record<string, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  tentativa: 'secondary',
  confirmada: 'default',
  cancelada: 'destructive',
  ejecutada: 'outline',
}

const STATUS_LABELS: Record<string, string> = {
  tentativa: 'Tentativa',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  ejecutada: 'Ejecutada',
}

const SIZE_LABELS: Record<string, string> = {
  S: 'Pequena',
  S_plus: 'S+',
  M: 'Mediana',
  L: 'Grande',
}

const MODALITY_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  mixta: 'Mixta',
  movil: 'Movil',
  institucional: 'Institucional',
}

function handleExport(rows: CampaignReportRow[]) {
  const exportRows = rows.map((r) => ({
    Codigo: r.code,
    Empresa: r.companyName ?? '',
    Municipio: r.municipality,
    Fecha: r.campaignDate,
    Tamano: SIZE_LABELS[r.size] ?? r.size,
    Modalidad: MODALITY_LABELS[r.modality] ?? r.modality,
    Estado: STATUS_LABELS[r.status] ?? r.status,
    'Personal Asignado': r.assignedCount,
    Coordinador: r.coordinator ?? '',
    Hexabank: r.hexabankCode ?? '',
  }))
  exportToExcel(exportRows, 'Campanas', 'reporte-campanas')
}

export function CampaignsReportTable({ rows }: CampaignsReportTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        No hay campanas para los filtros seleccionados.
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
              <TableHead>Codigo</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Municipio</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Tamano</TableHead>
              <TableHead>Modalidad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Personal Asignado</TableHead>
              <TableHead>Coordinador</TableHead>
              <TableHead>Hexabank</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.code}</TableCell>
                <TableCell>{row.companyName ?? '—'}</TableCell>
                <TableCell>{row.municipality}</TableCell>
                <TableCell>{row.campaignDate}</TableCell>
                <TableCell>{SIZE_LABELS[row.size] ?? row.size}</TableCell>
                <TableCell>{MODALITY_LABELS[row.modality] ?? row.modality}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[row.status] ?? 'secondary'}>
                    {STATUS_LABELS[row.status] ?? row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{row.assignedCount}</TableCell>
                <TableCell>{row.coordinator ?? '—'}</TableCell>
                <TableCell>{row.hexabankCode ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
