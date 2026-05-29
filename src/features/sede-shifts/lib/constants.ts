export const SHIFT_TYPE_LABELS: Record<string, string> = {
  diurno_completo: 'Diurno completo',
  noche: 'Noche',
  posturno: 'Posturno',
  servicios_transfusionales: 'Servicios transfusionales',
}

export const SHIFT_TYPE_DEFAULTS: Record<
  string,
  { startTime: string; endTime: string; totalHours: number; isOvernight: boolean }
> = {
  diurno_completo: { startTime: '07:00', endTime: '19:00', totalHours: 12, isOvernight: false },
  noche: { startTime: '19:00', endTime: '07:00', totalHours: 12, isOvernight: true },
  posturno: { startTime: '07:00', endTime: '13:00', totalHours: 6, isOvernight: false },
  servicios_transfusionales: { startTime: '07:00', endTime: '17:00', totalHours: 9, isOvernight: false },
}

export const SHIFT_TYPE_COLORS: Record<string, string> = {
  diurno_completo: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  noche: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  posturno: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  servicios_transfusionales: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
}
