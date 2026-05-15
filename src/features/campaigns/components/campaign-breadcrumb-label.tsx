'use client'

import { useEffect } from 'react'
import { useBreadcrumbOverrides } from '@/components/layout/breadcrumb-context'

export function CampaignBreadcrumbLabel({ id, code }: { id: string; code: string }) {
  const ctx = useBreadcrumbOverrides()
  const setOverride = ctx?.setOverride
  const clearOverride = ctx?.clearOverride

  useEffect(() => {
    if (!setOverride || !clearOverride) return
    setOverride(id, `Campaña ${code}`)
    return () => clearOverride(id)
  }, [setOverride, clearOverride, id, code])

  return null
}
