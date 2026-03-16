'use client'

import { useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StaffStatusBadge } from './staff-status-badge'
import { STAFF_PROFILE_LABELS, PAGE_LIMIT } from '@/features/staff/lib/constants'
import type { StaffMember } from '@/lib/db/schema/staff-members'

interface StaffTableProps {
  data: StaffMember[]
  total: number
  page: number
  onPageChange: (page: number) => void
  onEdit: (staff: StaffMember) => void
}

const columnHelper = createColumnHelper<StaffMember>()

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
      columnHelper.accessor('isActive', {
        header: 'Estado',
        cell: (info) => <StaffStatusBadge isActive={info.getValue()} />,
      }),
      columnHelper.display({
        id: 'acciones',
        header: 'Acciones',
        cell: (info) => (
          <div className="flex items-center gap-2">
            <Link
              href={`/personal/${info.row.original.id}`}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Ver
            </Link>
            <button
              type="button"
              onClick={() => onEdit(info.row.original)}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Editar
            </button>
          </div>
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
                    className="px-4 py-3 text-left font-medium text-muted-foreground"
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
