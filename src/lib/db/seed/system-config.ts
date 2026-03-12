import { db } from '@/lib/db'
import { systemConfig } from '@/lib/db/schema'

const SYSTEM_CONFIG_DEFAULTS = [
  {
    key: 'weekly_contract_hours',
    value: 44,
    description: 'Horas contratadas por semana para personal de planta',
  },
  {
    key: 'max_overtime_weekly',
    value: 12,
    description: 'Máximo de horas extras permitidas por semana',
  },
  {
    key: 'max_shift_hours',
    value: 12,
    description: 'Duración máxima de un turno en horas',
  },
  {
    key: 'min_rest_between_shifts',
    value: 8,
    description: 'Horas mínimas de descanso entre turnos',
  },
  {
    key: 'max_sundays_per_month',
    value: 2,
    description: 'Máximo de domingos trabajados por mes',
  },
  {
    key: 'max_overnights_per_month',
    value: 1,
    description: 'Máximo de trasnochadas por persona por mes',
  },
  {
    key: 'campaign_size_composition',
    value: {
      S: { bacteriologos: 1, tecnicos: 2, total: 3 },
      S_PLUS: { bacteriologos: 1, tecnicos: 3, total: 4 },
      M: { bacteriologos: 2, tecnicos: 4, total: 6 },
      L: { bacteriologos: 3, tecnicos: 6, total: 9 },
    },
    description: 'Composición de personal por tamaño de campaña',
  },
  {
    key: 'overtime_warning_threshold',
    value: 0.8,
    description: 'Porcentaje del límite de extras a partir del cual se genera advertencia (80%)',
  },
  {
    key: 'municipality_restriction_enabled',
    value: true,
    description: 'Validar restricción de municipio diferente en mismo día',
  },
] as const

export async function seedSystemConfig() {
  for (const config of SYSTEM_CONFIG_DEFAULTS) {
    await db
      .insert(systemConfig)
      .values({
        key: config.key,
        value: config.value,
        description: config.description,
      })
      .onConflictDoNothing({ target: systemConfig.key })
  }

  console.log(`System config seeded: ${SYSTEM_CONFIG_DEFAULTS.length} entries`)
}
