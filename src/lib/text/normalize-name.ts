/**
 * Normaliza un nombre para comparación/deduplicación robusta:
 * minúsculas, sin acentos/diacríticos, sin espacios redundantes.
 *
 * Ej: "  MEDELLÍN  Norte " → "medellin norte" === "Medellin   norte".
 * Se usa para deduplicar empresas, ubicaciones y contactos al importar el CRM,
 * donde el mismo valor llega con variaciones de mayúsculas/tildes/espacios.
 */
export function normalizeName(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // quita acentos/diéresis (también ñ→n)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}
