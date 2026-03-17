import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CampaignStatusBadge } from '@/features/campaigns/components/campaign-status-badge'

describe('CampaignStatusBadge', () => {
  it('shows "Tentativa" for tentativa status', () => {
    render(<CampaignStatusBadge status="tentativa" />)
    expect(screen.getByText('Tentativa')).toBeDefined()
  })

  it('shows "Confirmada" for confirmada status', () => {
    render(<CampaignStatusBadge status="confirmada" />)
    expect(screen.getByText('Confirmada')).toBeDefined()
  })

  it('shows "Cancelada" for cancelada status', () => {
    render(<CampaignStatusBadge status="cancelada" />)
    expect(screen.getByText('Cancelada')).toBeDefined()
  })

  it('shows "Ejecutada" for ejecutada status', () => {
    render(<CampaignStatusBadge status="ejecutada" />)
    expect(screen.getByText('Ejecutada')).toBeDefined()
  })

  it('applies green styling for confirmada', () => {
    const { container } = render(<CampaignStatusBadge status="confirmada" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('green')
  })

  it('applies red styling for cancelada', () => {
    const { container } = render(<CampaignStatusBadge status="cancelada" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('red')
  })

  it('applies gray styling for tentativa', () => {
    const { container } = render(<CampaignStatusBadge status="tentativa" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('gray')
  })
})
