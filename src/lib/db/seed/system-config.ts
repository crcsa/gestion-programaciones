import { db } from '../index'
import { systemConfig } from '../schema'

const CONFIG = [
  { key: 'weekly_hours', value: '44', description: 'Horas semanales de trabajo' },
  { key: 'max_extra_hours_month', value: '12', description: 'Maximo de horas extras por mes' },
  { key: 'max_sundays_month', value: '2', description: 'Maximo de domingos trabajados por mes' },
  { key: 'max_overnights_month', value: '1', description: 'Maximo de pernoctas por mes' },
  { key: 'max_shift_hours', value: '12', description: 'Maximo de horas por turno' },
]

export async function seedSystemConfig() {
  await db.insert(systemConfig).values(CONFIG).onConflictDoNothing()
}
