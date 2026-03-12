export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string | Record<string, string[]> }

export type PaginatedResult<T> = {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export type SortDirection = 'asc' | 'desc'
