import { db } from '../index'
import { systemConfig } from '../schema'

const CONFIG = [
  { key: 'weekly_hours', value: '44', description: 'Jornada semanal por contrato (horas)' },
  { key: 'max_extra_hours_week', value: '12', description: 'Maximo de horas extras por semana' },
  { key: 'max_shift_hours', value: '12', description: 'Maximo de horas por turno' },
  { key: 'min_rest_hours', value: '8', description: 'Descanso minimo entre turnos (horas)' },
  { key: 'max_sundays_month', value: '2', description: 'Maximo de domingos trabajados por mes' },
  { key: 'max_overnights_month', value: '1', description: 'Maximo de pernoctas por mes' },
  { key: 'municipal_cutoff_time', value: '17:00', description: 'Hora limite el dia previo a campaña en otro municipio' },
  { key: 'sede_municipality', value: 'Medellín', description: 'Municipio de la sede principal' },
]

export async function seedSystemConfig() {
  await db.insert(systemConfig).values(CONFIG).onConflictDoNothing()
}
