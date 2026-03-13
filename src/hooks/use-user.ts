'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/browser'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { Role } from '@/types/roles'

interface UseUserResult {
  user: User | null
  role: Role | null
  isLoading: boolean
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function loadUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      if (currentUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .single()

        setRole((profile?.role as Role) ?? null)
      }

      setIsLoading(false)
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setRole(null)
        setIsLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, role, isLoading }
}
