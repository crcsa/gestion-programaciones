'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { StaffForm } from '@/features/staff/components/staff-form'
import { getStaffById, updateStaff } from '@/features/staff/actions/staff-actions'
import { getActiveTrainingAreas } from '@/features/training-areas/actions/training-area-actions'
import type { CreateStaffInput } from '@/features/staff/schemas/staff-schemas'
import { LoadingSkeleton } from '@/components/feedback/loading-skeleton'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function EditarPersonalPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: staffResult, isLoading: staffLoading } = useQuery({
    queryKey: ['staff', params.id],
    queryFn: () => getStaffById(params.id),
    enabled: !!params.id,
  })

  const { data: areasResult } = useQuery({
    queryKey: ['training-areas', 'active'],
    queryFn: getActiveTrainingAreas,
  })

  const trainingAreas = areasResult?.success ? areasResult.data : []

  const mutation = useMutation({
    mutationFn: (data: CreateStaffInput) =>
      updateStaff({ id: params.id, ...data }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Personal actualizado exitosamente')
        queryClient.invalidateQueries({ queryKey: ['staff'] })
        router.push(`/personal/${params.id}`)
      } else {
        const errorMsg =
          typeof result.error === 'string'
            ? result.error
            : 'Error de validación'
        toast.error(errorMsg)
      }
    },
    onError: () => {
      toast.error('Error al actualizar personal')
    },
  })

  if (staffLoading) {
    return <LoadingSkeleton lines={8} />
  }

  if (!staffResult?.success) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        Personal no encontrado
      </div>
    )
  }

  const staff = staffResult.data

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/personal/${params.id}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Editar: {staff.firstName} {staff.lastName}
          </h1>
          <p className="text-muted-foreground">
            Modificar información del personal
          </p>
        </div>
      </div>

      <StaffForm
        defaultValues={{
          documentNumber: staff.documentNumber,
          firstName: staff.firstName,
          lastName: staff.lastName,
          phone: staff.phone ?? undefined,
          profileType: staff.profileType,
          contractType: staff.contractType ?? undefined,
          weeklyContractHours: staff.weeklyContractHours,
          maxOvertimeWeekly: staff.maxOvertimeWeekly,
          maxShiftHours: staff.maxShiftHours,
          defaultShiftType: staff.defaultShiftType ?? undefined,
          trainingAreaIds: staff.trainingAreas.map((a) => a.id),
        }}
        trainingAreas={trainingAreas.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
        }))}
        onSubmit={async (data) => mutation.mutateAsync(data)}
        isSubmitting={mutation.isPending}
        submitLabel="Guardar Cambios"
      />
    </div>
  )
}
