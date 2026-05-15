'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { StaffForm } from './staff-form'
import { createStaff, updateStaff } from '@/features/staff/actions/staff-actions'
import type { CreateStaffInput } from '@/features/staff/schemas/staff-schemas'
import type { TrainingArea } from '@/lib/db/schema/training-areas'
import type { Area } from '@/types/areas'

interface CommonProps {
  areas: TrainingArea[]
  defaultWeeklyHours: number
  /** True si el caller es admin global (puede elegir cualquier área). */
  canSelectArea?: boolean
  /** Área del caller (para fijarla en el formulario cuando no puede elegir). */
  callerArea?: Area | null
  onSuccess?: () => void
}

interface CreateMode extends CommonProps {
  mode: 'create'
}

interface EditMode extends CommonProps {
  mode: 'edit'
  staffId: string
  defaultValues: Partial<CreateStaffInput>
}

type StaffFormClientProps = CreateMode | EditMode

export function StaffFormClient(props: StaffFormClientProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState<boolean>(false)

  async function handleSubmit(data: CreateStaffInput) {
    setIsLoading(true)
    try {
      if (props.mode === 'edit') {
        await updateStaff(props.staffId, data)
        toast.success('Colaborador actualizado correctamente')
        if (props.onSuccess) {
          props.onSuccess()
        } else {
          router.push(`/personal/${props.staffId}`)
        }
      } else {
        await createStaff(data)
        toast.success('Colaborador creado correctamente')
        if (props.onSuccess) {
          props.onSuccess()
        } else {
          router.push('/personal')
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar el colaborador')
    } finally {
      setIsLoading(false)
    }
  }

  const defaultValues = props.mode === 'edit' ? props.defaultValues : undefined

  return (
    <StaffForm
      defaultValues={defaultValues}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      areas={props.areas}
      defaultWeeklyHours={props.defaultWeeklyHours}
      canSelectArea={props.canSelectArea ?? false}
      callerArea={props.callerArea ?? null}
    />
  )
}
