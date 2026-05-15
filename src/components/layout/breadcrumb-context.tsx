'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'

interface BreadcrumbContextValue {
  overrides: Record<string, string>
  setOverride: (segment: string, label: string) => void
  clearOverride: (segment: string) => void
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null)

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  const setOverride = useCallback((segment: string, label: string) => {
    setOverrides((prev) => (prev[segment] === label ? prev : { ...prev, [segment]: label }))
  }, [])

  const clearOverride = useCallback((segment: string) => {
    setOverrides((prev) => {
      if (!(segment in prev)) return prev
      const { [segment]: _removed, ...rest } = prev
      void _removed
      return rest
    })
  }, [])

  const value = useMemo(
    () => ({ overrides, setOverride, clearOverride }),
    [overrides, setOverride, clearOverride],
  )

  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>
}

export function useBreadcrumbOverrides() {
  return useContext(BreadcrumbContext)
}
