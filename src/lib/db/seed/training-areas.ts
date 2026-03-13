import { db } from '../index'
import { trainingAreas } from '../schema'

const AREAS = [
  { name: 'Banco de Sangre', description: 'Procesamiento y almacenamiento de sangre' },
  { name: 'Colecta', description: 'Recoleccion de donaciones de sangre' },
  { name: 'Serologia', description: 'Analisis serologicos' },
  { name: 'Hematologia', description: 'Analisis hematologicos' },
  { name: 'Medicina Transfusional', description: 'Procesos de transfusion' },
  { name: 'Aferesis', description: 'Procedimientos de aferesis' },
  { name: 'Control de Calidad', description: 'Control de calidad de procesos' },
  { name: 'Coordinacion', description: 'Coordinacion de campanas y equipos' },
]

export async function seedTrainingAreas() {
  await db.insert(trainingAreas).values(AREAS).onConflictDoNothing()
}
