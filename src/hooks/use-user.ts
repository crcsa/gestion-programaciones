'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/browser'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import { parseRole, type Role } from '@/types/roles'

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

    async function fetchProfileRole(userId: string): Promise<void> {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
      setRole(parseRole(profile?.role))
    }

    async function loadUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)
      if (currentUser) {
        await fetchProfileRole(currentUser.id)
      }
      setIsLoading(false)
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfileRole(session.user.id)
        } else {
          setRole(null)
        }
        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, role, isLoading }
}
