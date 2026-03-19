'use client'

import { useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import Link from 'next/link'
import { Eye, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { StaffStatusBadge } from './staff-status-badge'
import { STAFF_PROFILE_LABELS, PAGE_LIMIT } from '@/features/staff/lib/constants'
import type { StaffListRow } from '@/features/staff/actions/staff-actions'

interface StaffTableProps {
  data: StaffListRow[]
  total: number
  page: number
  onPageChange: (page: number) => void
  onEdit: (staff: StaffListRow) => void
}

const columnHelper = createColumnHelper<StaffListRow>()

export function StaffTable({ data, total, page, onPageChange, onEdit }: StaffTableProps) {
  const columns = useMemo(
    () => [
      columnHelper.accessor(
        (row) => `${row.firstName} ${row.lastName}`,
        {
          id: 'fullName',
          header: 'Nombre completo',
          cell: (info) => info.getValue(),
        }
      ),
      columnHelper.accessor('cedula', {
        header: 'Cédula',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('staffProfile', {
        header: 'Perfil',
        cell: (info) => STAFF_PROFILE_LABELS[info.getValue()] ?? info.getValue(),
      }),
      columnHelper.accessor('trainingAreaNames', {
        header: 'Área',
        cell: (info) => {
          const names = info.getValue()
          if (names.length === 0) return <span className="text-muted-foreground text-xs">—</span>
          return <span className="text-xs">{names.join(', ')}</span>
        },
      }),
      columnHelper.accessor('isActive', {
        header: 'Estado',
        cell: (info) => <StaffStatusBadge isActive={info.getValue()} />,
      }),
      columnHelper.display({
        id: 'acciones',
        header: 'Acciones',
        cell: (info) => (
          <TooltipProvider>
            <div className="flex items-center justify-end gap-1">
              <Tooltip>
                <TooltipTrigger render={
                  <Link
                    href={`/personal/${info.row.original.id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">Ver</span>
                  </Link>
                } />
                <TooltipContent>Ver detalle</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger render={
                  <button
                    type="button"
                    onClick={() => onEdit(info.row.original)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Editar</span>
                  </button>
                } />
                <TooltipContent>Editar</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        ),
      }),
    ],
    [onEdit]
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
                    className={`px-4 py-3 text-left font-medium text-muted-foreground ${header.id === 'acciones' ? 'w-24 text-right' : ''}`}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
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
                  No hay personal registrado
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrev}
              onClick={() => onPageChange(page - 1)}
              className="h-8 w-8 p-0"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onClick={() => onPageChange(page + 1)}
              className="h-8 w-8 p-0"
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
