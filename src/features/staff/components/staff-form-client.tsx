'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { StaffForm } from './staff-form'
import { createStaff, updateStaff } from '@/features/staff/actions/staff-actions'
import type { CreateStaffInput } from '@/features/staff/schemas/staff-schemas'

interface CreateMode {
  mode: 'create'
}

interface EditMode {
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
        toast.success('Funcionario actualizado correctamente')
        router.push(`/personal/${props.staffId}`)
      } else {
        await createStaff(data)
        toast.success('Funcionario creado correctamente')
        router.push('/personal')
      }
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
      areas={[]}
    />
  )
}
