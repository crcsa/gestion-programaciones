'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { recalculateAllWeeklyBalances } from '../actions/hours-actions'

export function RecalculateButton({ weekStart }: { weekStart: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleClick = async () => {
    setLoading(true)
    try {
      const result = await recalculateAllWeeklyBalances(weekStart)
      router.refresh()
      if (result.errors.length > 0) {
        toast.warning(`${result.updated} actualizados, ${result.errors.length} fallaron`, {
          description: result.errors[0]?.message,
          duration: 10000,
        })
      } else {
        toast.success(`${result.updated} colaboradores recalculados correctamente`)
      }
    } catch {
      toast.error('Error al recalcular los balances')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
      {loading ? 'Recalculando...' : 'Recalcular semana'}
    </Button>
  )
}
