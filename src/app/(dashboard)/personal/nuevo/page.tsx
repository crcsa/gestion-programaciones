'use client'

import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { StaffForm } from '@/features/staff/components/staff-form'
import { createStaff } from '@/features/staff/actions/staff-actions'
import { getActiveTrainingAreas } from '@/features/training-areas/actions/training-area-actions'
import type { CreateStaffInput } from '@/features/staff/schemas/staff-schemas'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NuevoPersonalPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: areasResult } = useQuery({
    queryKey: ['training-areas', 'active'],
    queryFn: getActiveTrainingAreas,
  })

  const trainingAreas = areasResult?.success ? areasResult.data : []

  const mutation = useMutation({
    mutationFn: (data: CreateStaffInput) => createStaff(data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Personal creado exitosamente')
        queryClient.invalidateQueries({ queryKey: ['staff'] })
        router.push('/personal')
      } else {
        const errorMsg =
          typeof result.error === 'string'
            ? result.error
            : 'Error de validación'
        toast.error(errorMsg)
      }
    },
    onError: () => {
      toast.error('Error al crear personal')
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/personal"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nuevo Personal</h1>
          <p className="text-muted-foreground">
            Registrar nuevo miembro del personal
          </p>
        </div>
      </div>

      <StaffForm
        trainingAreas={trainingAreas.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
        }))}
        onSubmit={async (data) => mutation.mutateAsync(data)}
        isSubmitting={mutation.isPending}
        submitLabel="Crear Personal"
      />
    </div>
  )
}
