export function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim()
}

export function formatDocumentNumber(doc: string): string {
  return doc.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function formatHours(decimalHours: number): string {
  const hours = Math.floor(decimalHours)
  const minutes = Math.round((decimalHours - hours) * 60)
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}
