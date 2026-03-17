'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { StaffForm } from './staff-form'
import { createStaff, updateStaff } from '@/features/staff/actions/staff-actions'
import type { CreateStaffInput } from '@/features/staff/schemas/staff-schemas'
import type { TrainingArea } from '@/lib/db/schema/training-areas'

interface CreateMode {
  mode: 'create'
  areas: TrainingArea[]
  onSuccess?: () => void
}

interface EditMode {
  mode: 'edit'
  staffId: string
  defaultValues: Partial<CreateStaffInput>
  areas: TrainingArea[]
  onSuccess?: () => void
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
        toast.success('Funcionario actualizado correctamente')
        if (props.onSuccess) {
          props.onSuccess()
        } else {
          router.push(`/personal/${props.staffId}`)
        }
      } else {
        await createStaff(data)
        toast.success('Funcionario creado correctamente')
        if (props.onSuccess) {
          props.onSuccess()
        } else {
          router.push('/personal')
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar el funcionario')
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
    />
  )
}
