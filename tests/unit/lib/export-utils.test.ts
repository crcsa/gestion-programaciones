import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn().mockReturnValue({}),
    book_new: vi.fn().mockReturnValue({}),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}))

import * as XLSX from 'xlsx'
import { exportToExcel } from '@/lib/excel/export-utils'

describe('exportToExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls XLSX.utils.json_to_sheet with rows', () => {
    const rows = [{ name: 'Ana', age: 30 }, { name: 'Carlos', age: 25 }]
    exportToExcel(rows, 'Hoja1', 'test-file')

    expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(rows)
  })

  it('calls XLSX.utils.book_append_sheet with correct sheetName', () => {
    const rows = [{ col: 'value' }]
    exportToExcel(rows, 'MiHoja', 'archivo')

    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'MiHoja',
    )
  })

  it('calls XLSX.writeFile with correct fileName appending .xlsx', () => {
    const rows = [{ data: 1 }]
    exportToExcel(rows, 'Sheet', 'reporte-campanas')

    expect(XLSX.writeFile).toHaveBeenCalledWith(
      expect.anything(),
      'reporte-campanas.xlsx',
    )
  })
})
