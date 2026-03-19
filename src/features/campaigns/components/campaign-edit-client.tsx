'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CampaignForm } from './campaign-form'
import { updateCampaign } from '@/features/campaigns/actions/campaign-actions'
import type { CreateCampaignInput } from '@/features/campaigns/schemas/campaign-schemas'

interface CampaignEditClientProps {
  campaignId: string
  defaultValues: Partial<CreateCampaignInput>
}

export function CampaignEditClient({ campaignId, defaultValues }: CampaignEditClientProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(data: CreateCampaignInput) {
    setIsLoading(true)
    try {
      const { code: _code, ...rest } = data
      await updateCampaign(campaignId, rest)
      toast.success('Campaña actualizada correctamente')
      router.push(`/campanas/${campaignId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar la campaña')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <CampaignForm
      defaultValues={defaultValues}
      onSubmit={handleSubmit}
      isLoading={isLoading}
    />
  )
}
