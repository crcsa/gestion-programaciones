import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
  Clock: () => <svg data-testid="icon-clock" />,
  Grid3x3: () => <svg data-testid="icon-grid" />,
  Building2: () => <svg data-testid="icon-building" />,
  BarChart3: () => <svg data-testid="icon-barchart" />,
  ShieldCheck: () => <svg data-testid="icon-shield" />,
  UserCog: () => <svg data-testid="icon-usercog" />,
  Truck: () => <svg data-testid="icon-truck" />,
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

  it('shows no items when role is null', () => {
    // Sidebar ahora consume canAccess. role=null nunca pasa el predicate,
    // así que no debe renderizar ningún link (evita exponer rutas a la
    // sesión vacía).
    render(<Sidebar role={null} />)
    expect(screen.queryByText('Dashboard')).toBeNull()
  })

  it('applies hover style on mouse enter for inactive item', () => {
    render(<Sidebar role="admin" />)
    const links = document.querySelectorAll('a')
    // Find a non-active link (not '/')
    const nonActiveLink = Array.from(links).find((l) => l.getAttribute('href') !== '/')
    if (nonActiveLink) {
      fireEvent.mouseEnter(nonActiveLink)
      fireEvent.mouseLeave(nonActiveLink)
    }
    // Smoke test — no error thrown
    expect(screen.getByText('Dashboard')).toBeDefined()
  })
})
