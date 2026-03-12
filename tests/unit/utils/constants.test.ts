import { describe, it, expect } from 'vitest'
import {
  CAMPAIGN_SIZE_COMPOSITION,
  CAMPAIGN_SIZE_LABELS,
  PROFILE_TYPE_LABELS,
} from '@/lib/utils/constants'

describe('CAMPAIGN_SIZE_COMPOSITION', () => {
  it('S has 1 bacteriologo + 2 tecnicos = 3', () => {
    expect(CAMPAIGN_SIZE_COMPOSITION.S.total).toBe(3)
    expect(CAMPAIGN_SIZE_COMPOSITION.S.bacteriologos).toBe(1)
    expect(CAMPAIGN_SIZE_COMPOSITION.S.tecnicos).toBe(2)
  })

  it('S_PLUS has 1 bacteriologo + 3 tecnicos = 4', () => {
    expect(CAMPAIGN_SIZE_COMPOSITION.S_PLUS.total).toBe(4)
  })

  it('M has 2 bacteriologos + 4 tecnicos = 6', () => {
    expect(CAMPAIGN_SIZE_COMPOSITION.M.total).toBe(6)
  })

  it('L has 3 bacteriologos + 6 tecnicos = 9', () => {
    expect(CAMPAIGN_SIZE_COMPOSITION.L.total).toBe(9)
  })
})

describe('CAMPAIGN_SIZE_LABELS', () => {
  it('S_PLUS displays as S+', () => {
    expect(CAMPAIGN_SIZE_LABELS.S_PLUS).toBe('S+')
  })
})

describe('PROFILE_TYPE_LABELS', () => {
  it('has all 4 profiles in Spanish', () => {
    expect(PROFILE_TYPE_LABELS.bacteriologo).toBe('Bacteriólogo')
    expect(PROFILE_TYPE_LABELS.medico).toBe('Médico')
    expect(PROFILE_TYPE_LABELS.tecnico_operativo).toBe('Técnico Operativo')
    expect(PROFILE_TYPE_LABELS.tecnico_administrativo).toBe('Técnico Administrativo')
  })
})
