import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { TurnosClient } from '@/features/sede-shifts/components/turnos-client'
import { Skeleton } from '@/components/ui/skeleton'
import type { Role } from '@/types/roles'

async function getCurrentRole(): Promise<Role | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (profile?.role as Role) ?? null
}

async function TurnosSection() {
  const currentRole = await getCurrentRole()

  return <TurnosClient currentRole={currentRole} />
}

export default async function TurnosPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      }
    >
      <TurnosSection />
    </Suspense>
  )
}
