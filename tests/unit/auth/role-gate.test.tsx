import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RoleGate } from '@/features/auth/components/role-gate'

describe('RoleGate', () => {
  it('renders children when role is allowed', () => {
    render(
      <RoleGate allowedRoles={['admin', 'admin_area']} currentRole="admin">
        <span>Contenido admin</span>
      </RoleGate>
    )
    expect(screen.getByText('Contenido admin')).toBeDefined()
  })

  it('renders fallback when role is not allowed', () => {
    render(
      <RoleGate allowedRoles={['admin']} currentRole="operativo" fallback={<span>Sin acceso</span>}>
        <span>Contenido admin</span>
      </RoleGate>
    )
    expect(screen.getByText('Sin acceso')).toBeDefined()
    expect(screen.queryByText('Contenido admin')).toBeNull()
  })

  it('renders fallback when role is null', () => {
    render(
      <RoleGate allowedRoles={['admin']} currentRole={null} fallback={<span>Sin acceso</span>}>
        <span>Contenido</span>
      </RoleGate>
    )
    expect(screen.getByText('Sin acceso')).toBeDefined()
  })

  it('renders nothing by default when not allowed and no fallback', () => {
    const { container } = render(
      <RoleGate allowedRoles={['admin']} currentRole="operativo">
        <span>Contenido</span>
      </RoleGate>
    )
    expect(screen.queryByText('Contenido')).toBeNull()
    expect(container.firstChild).toBeNull()
  })
})
