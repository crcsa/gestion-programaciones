'use client'

import { useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { CampaignStatusBadge } from './campaign-status-badge'
import { CampaignSizeBadge } from './campaign-size-badge'
import { CAMPAIGN_MODALITY_LABELS, PAGE_LIMIT } from '@/features/campaigns/lib/constants'
import type { CampaignListItem } from '@/features/campaigns/actions/campaign-actions'

interface CampaignTableProps {
  data: CampaignListItem[]
  total: number
  page: number
  onPageChange: (page: number) => void
  onEdit: (campaign: CampaignListItem) => void
  onConfirm?: (campaign: CampaignListItem) => void
  onCancel?: (campaign: CampaignListItem) => void
}

const columnHelper = createColumnHelper<CampaignListItem>()

export function CampaignTable({
  data,
  total,
  page,
  onPageChange,
  onEdit,
  onConfirm,
  onCancel,
}: CampaignTableProps) {
  const columns = useMemo(
    () => [
      columnHelper.accessor('code', {
        header: 'Código',
        cell: (info) => (
          <span className="font-mono text-xs">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('companyName', {
        header: 'Empresa',
        cell: (info) => info.getValue() ?? '—',
      }),
      columnHelper.accessor('municipality', {
        header: 'Municipio',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('campaignDate', {
        header: 'Fecha',
        cell: (info) => {
          const raw = info.getValue()
          try {
            return format(new Date(`${raw}T00:00:00`), 'dd/MM/yyyy', { locale: es })
          } catch {
            return raw
          }
        },
      }),
      columnHelper.accessor('size', {
        header: 'Tamaño',
        cell: (info) => <CampaignSizeBadge size={info.getValue()} />,
      }),
      columnHelper.accessor('modality', {
        header: 'Modalidad',
        cell: (info) =>
          CAMPAIGN_MODALITY_LABELS[info.getValue()] ?? info.getValue(),
      }),
      columnHelper.accessor('status', {
        header: 'Estado',
        cell: (info) => <CampaignStatusBadge status={info.getValue()} />,
      }),
      columnHelper.display({
        id: 'acciones',
        header: 'Acciones',
        cell: (info) => {
          const campaign = info.row.original
          const isTentativa = campaign.status === 'tentativa'
          const canCancel =
            campaign.status !== 'cancelada' && campaign.status !== 'ejecutada'

          return (
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/campanas/${campaign.id}`}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Ver
              </Link>
              {isTentativa && (
                <button
                  type="button"
                  onClick={() => onEdit(campaign)}
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Editar
                </button>
              )}
              {isTentativa && onConfirm && (
                <button
                  type="button"
                  onClick={() => onConfirm(campaign)}
                  className="text-sm text-green-600 underline-offset-4 hover:underline"
                >
                  Confirmar
                </button>
              )}
              {canCancel && onCancel && (
                <button
                  type="button"
                  onClick={() => onCancel(campaign)}
                  className="text-sm text-destructive underline-offset-4 hover:underline"
                >
                  Cancelar
                </button>
              )}
            </div>
          )
        },
      }),
    ],
    [onEdit, onConfirm, onCancel]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const totalPages = Math.ceil(total / PAGE_LIMIT)
  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium text-muted-foreground"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No hay campañas registradas
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages} ({total} registros)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrev}
              onClick={() => onPageChange(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onClick={() => onPageChange(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
