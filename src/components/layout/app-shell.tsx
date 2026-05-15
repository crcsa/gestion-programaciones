import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { MobileNav } from './mobile-nav'
import { BreadcrumbProvider } from './breadcrumb-context'
import type { Role } from '@/types/roles'
import type { Area } from '@/types/areas'

interface AppShellProps {
  children: React.ReactNode
  role: Role | null
  area?: Area | null
  email: string | undefined
}

export function AppShell({ children, role, area = null, email }: AppShellProps) {
  return (
    <BreadcrumbProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex">
          <Sidebar role={role} area={area} />
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center border-b border-border bg-background px-4 md:hidden">
            <MobileNav role={role} />
          </div>
          <Topbar userEmail={email} role={role} />

          <main className="flex-1 overflow-y-auto bg-background p-6">{children}</main>
        </div>
      </div>
    </BreadcrumbProvider>
  )
}
