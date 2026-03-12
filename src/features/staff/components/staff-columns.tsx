'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { PROFILE_TYPE_LABELS } from '@/lib/utils/constants'
import { formatDocumentNumber } from '@/lib/utils/format'
import { Eye, Pencil } from 'lucide-react'
import Link from 'next/link'

interface StaffRow {
  id: string
  documentNumber: string
  firstName: string
  lastName: string
  profileType: string
  isActive: boolean
  trainingAreas: Array<{ id: string; code: string; name: string }>
}

export const staffColumns: ColumnDef<StaffRow>[] = [
  {
    accessorKey: 'documentNumber',
    header: 'Documento',
    cell: ({ row }) => formatDocumentNumber(row.getValue('documentNumber')),
  },
  {
    id: 'fullName',
    header: 'Nombre',
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
  },
  {
    accessorKey: 'profileType',
    header: 'Perfil',
    cell: ({ row }) => {
      const profile = row.getValue('profileType') as keyof typeof PROFILE_TYPE_LABELS
      return (
        <Badge variant="outline">
          {PROFILE_TYPE_LABELS[profile] ?? profile}
        </Badge>
      )
    },
  },
  {
    id: 'areas',
    header: 'Áreas',
    cell: ({ row }) => {
      const areas = row.original.trainingAreas
      if (areas.length === 0) return <span className="text-muted-foreground">—</span>
      return (
        <div className="flex flex-wrap gap-1">
          {areas.slice(0, 2).map((area) => (
            <Badge key={area.id} variant="secondary" className="text-xs">
              {area.code}
            </Badge>
          ))}
          {areas.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{areas.length - 2}
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'isActive',
    header: 'Estado',
    cell: ({ row }) => (
      <Badge variant={row.getValue('isActive') ? 'default' : 'secondary'}>
        {row.getValue('isActive') ? 'Activo' : 'Inactivo'}
      </Badge>
    ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <div className="flex gap-1">
        <Link
          href={`/personal/${row.original.id}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          <Eye className="h-4 w-4" />
        </Link>
        <Link
          href={`/personal/${row.original.id}/editar`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          <Pencil className="h-4 w-4" />
        </Link>
      </div>
    ),
  },
]
