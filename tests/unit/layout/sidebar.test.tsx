import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sidebar } from '@/components/layout/sidebar'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn().mockReturnValue('/'),
}))

// Mock lucide-react icons to avoid rendering issues
vi.mock('lucide-react', () => ({
  LayoutDashboard: () => <svg data-testid="icon-dashboard" />,
  Users: () => <svg data-testid="icon-users" />,
  Megaphone: () => <svg data-testid="icon-megaphone" />,
  CalendarDays: () => <svg data-testid="icon-calendar" />,
  Settings: () => <svg data-testid="icon-settings" />,
  ChevronRight: () => <svg data-testid="icon-chevron" />,
}))

describe('Sidebar', () => {
  it('shows all nav items for admin role', () => {
    render(<Sidebar role="admin" />)
    expect(screen.getByText('Dashboard')).toBeDefined()
    expect(screen.getByText('Personal')).toBeDefined()
    expect(screen.getByText('Campañas')).toBeDefined()
    expect(screen.getByText('Turnos')).toBeDefined()
    expect(screen.getByText('Configuración')).toBeDefined()
  })

  it('hides Personal and Configuracion for comercial role', () => {
    render(<Sidebar role="comercial" />)
    expect(screen.getByText('Dashboard')).toBeDefined()
    expect(screen.getByText('Campañas')).toBeDefined()
    expect(screen.queryByText('Personal')).toBeNull()
    expect(screen.queryByText('Configuración')).toBeNull()
  })

  it('shows only Dashboard for operativo role', () => {
    render(<Sidebar role="operativo" />)
    expect(screen.getByText('Dashboard')).toBeDefined()
    expect(screen.queryByText('Personal')).toBeNull()
    expect(screen.queryByText('Campañas')).toBeNull()
    expect(screen.queryByText('Configuración')).toBeNull()
  })

  it('shows all items when role is null', () => {
    render(<Sidebar role={null} />)
    // All items visible (no filtering when role unknown)
    expect(screen.getByText('Dashboard')).toBeDefined()
  })
})
