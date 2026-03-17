'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CampaignForm } from './campaign-form'
import { createCampaign } from '@/features/campaigns/actions/campaign-actions'
import type { CreateCampaignInput } from '@/features/campaigns/schemas/campaign-schemas'

export function CampaignCreateClient() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(data: CreateCampaignInput) {
    setIsLoading(true)
    try {
      await createCampaign(data)
      toast.success('Campana creada correctamente')
      router.push('/campanas')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear la campana')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <CampaignForm
      onSubmit={handleSubmit}
      isLoading={isLoading}
    />
  )
}
