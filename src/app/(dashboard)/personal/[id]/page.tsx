'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getStaffById } from '@/features/staff/actions/staff-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PROFILE_TYPE_LABELS } from '@/lib/utils/constants'
import { formatDocumentNumber } from '@/lib/utils/format'
import { LoadingSkeleton } from '@/components/feedback/loading-skeleton'
import { Pencil, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function StaffDetailPage() {
  const params = useParams<{ id: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ['staff', params.id],
    queryFn: () => getStaffById(params.id),
    enabled: !!params.id,
  })

  if (isLoading) {
    return <LoadingSkeleton lines={8} />
  }

  if (!data?.success) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        Personal no encontrado
      </div>
    )
  }

  const staff = data.data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/personal"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {staff.firstName} {staff.lastName}
            </h1>
            <p className="text-muted-foreground">
              {formatDocumentNumber(staff.documentNumber)}
            </p>
          </div>
        </div>
        <Link href={`/personal/${staff.id}/editar`}>
          <Button variant="outline">
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Perfil</span>
              <Badge variant="outline">
                {PROFILE_TYPE_LABELS[staff.profileType as keyof typeof PROFILE_TYPE_LABELS]}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estado</span>
              <Badge variant={staff.isActive ? 'default' : 'secondary'}>
                {staff.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            {staff.phone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Teléfono</span>
                <span>{staff.phone}</span>
              </div>
            )}
            {staff.contractType && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contrato</span>
                <span>{staff.contractType}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Horario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horas/Semana</span>
              <span>{staff.weeklyContractHours}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Máx. Extras/Semana</span>
              <span>{staff.maxOvertimeWeekly}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Máx. Horas/Turno</span>
              <span>{staff.maxShiftHours}h</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Áreas de Formación</CardTitle>
          </CardHeader>
          <CardContent>
            {staff.trainingAreas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {staff.trainingAreas.map((area) => (
                  <Badge key={area.id} variant="secondary">
                    {area.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin áreas de formación asignadas
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
