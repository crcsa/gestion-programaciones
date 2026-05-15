import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { getCurrentUserContext } from '@/features/auth/lib/user-context'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentUserContext()
  if (!ctx) {
    redirect('/login')
  }

  return (
    <AppShell email={ctx.email} role={ctx.role} area={ctx.area}>
      {children}
    </AppShell>
  )
}
