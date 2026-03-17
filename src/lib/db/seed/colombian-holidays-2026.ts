import { db } from '../index'
import { colombianHolidays } from '../schema'

const HOLIDAYS_2026 = [
  { holidayDate: '2026-01-01', name: 'Ano Nuevo' },
  { holidayDate: '2026-01-12', name: 'Dia de los Reyes Magos' },
  { holidayDate: '2026-03-23', name: 'Dia de San Jose' },
  { holidayDate: '2026-04-02', name: 'Jueves Santo' },
  { holidayDate: '2026-04-03', name: 'Viernes Santo' },
  { holidayDate: '2026-05-01', name: 'Dia del Trabajo' },
  { holidayDate: '2026-05-18', name: 'Ascension del Senor' },
  { holidayDate: '2026-06-08', name: 'Corpus Christi' },
  { holidayDate: '2026-06-15', name: 'Sagrado Corazon de Jesus' },
  { holidayDate: '2026-06-29', name: 'San Pedro y San Pablo' },
  { holidayDate: '2026-07-20', name: 'Dia de la Independencia' },
  { holidayDate: '2026-08-07', name: 'Batalla de Boyaca' },
  { holidayDate: '2026-08-17', name: 'La Asuncion de la Virgen' },
  { holidayDate: '2026-10-12', name: 'Dia de la Raza' },
  { holidayDate: '2026-11-02', name: 'Todos los Santos' },
  { holidayDate: '2026-11-16', name: 'Independencia de Cartagena' },
  { holidayDate: '2026-12-08', name: 'Inmaculada Concepcion' },
  { holidayDate: '2026-12-25', name: 'Navidad' },
]

export async function seedColombianHolidays2026() {
  await db.insert(colombianHolidays).values(HOLIDAYS_2026).onConflictDoNothing()
}
