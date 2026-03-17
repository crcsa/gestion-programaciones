import { db } from '../index'
import { trainingAreas } from '../schema'

const AREAS = [
  // Técnico
  {
    name: 'Atención Donantes Campañas - Sede - Punto Fijo',
    description: 'Atención y recepción de donantes en campañas, sede y puntos fijos',
    forProfiles: ['tecnico'],
  },
  {
    name: 'Encuestas - Inventario',
    description: 'Aplicación de encuestas a donantes y gestión de inventario',
    forProfiles: ['tecnico'],
  },
  {
    name: 'Aféresis',
    description: 'Procedimientos de aféresis para técnicos',
    forProfiles: ['tecnico'],
  },
  // Bacteriólogo
  {
    name: 'Selección Donantes Campañas - Sede - Punto Fijo',
    description: 'Selección y evaluación de donantes en campañas, sede y puntos fijos',
    forProfiles: ['bacteriologo'],
  },
  {
    name: 'Aféresis Amicus',
    description: 'Procedimientos de aféresis con equipo Amicus',
    forProfiles: ['bacteriologo'],
  },
  {
    name: 'Inmunohematología',
    description: 'Análisis y pruebas de inmunohematología',
    forProfiles: ['bacteriologo'],
  },
  {
    name: 'Inmunoserología',
    description: 'Análisis y pruebas de inmunoserología',
    forProfiles: ['bacteriologo'],
  },
  {
    name: 'Servicios Transfusionales',
    description: 'Gestión y soporte de servicios transfusionales',
    forProfiles: ['bacteriologo'],
  },
  // Compartida: Técnico + Bacteriólogo
  {
    name: 'Fraccionamiento',
    description: 'Procesamiento y fraccionamiento de componentes sanguíneos',
    forProfiles: ['tecnico', 'bacteriologo'],
  },
]

export async function seedTrainingAreas() {
  await db.delete(trainingAreas)
  await db.insert(trainingAreas).values(AREAS)
}
