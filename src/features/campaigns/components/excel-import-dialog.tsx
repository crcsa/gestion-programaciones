'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { importCampaignsFromExcel } from '@/features/campaigns/actions/campaign-actions'
import type { ImportExcelRow } from '@/features/campaigns/schemas/campaign-schemas'
import type { ImportResult } from '@/features/campaigns/actions/campaign-actions'
import { parseCrmWorkbook } from '@/features/campaigns/lib/crm-excel-parser'

// ---- Component ------------------------------------------------------------

interface ExcelImportDialogProps {
  onSuccess: () => void
}

type Step = 'idle' | 'preview' | 'result'

export function ExcelImportDialog({ onSuccess }: ExcelImportDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('idle')
  const [parsedRows, setParsedRows] = useState<ImportExcelRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleOpen() {
    setStep('idle')
    setParsedRows([])
    setParseError(null)
    setResult(null)
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const rows = parseCrmWorkbook(workbook)

        if (rows.length === 0) {
          setParseError('El archivo no contiene campañas reconocibles. Verifica que sea el export del CRM.')
          return
        }

        setParsedRows(rows)
        setStep('preview')
      } catch {
        setParseError('No se pudo leer el archivo. Asegúrese de que es un Excel válido.')
      }
    }
    reader.readAsArrayBuffer(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  async function handleImport() {
    setIsImporting(true)
    try {
      const r = await importCampaignsFromExcel(parsedRows)
      setResult(r)
      setStep('result')
      if (r.imported > 0) {
        toast.success(`${r.imported} campaña(s) importada(s) correctamente`)
        onSuccess()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={handleOpen}>
        <Upload className="h-4 w-4 mr-2" />
        Importar Excel
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar campañas desde Excel</DialogTitle>
          </DialogHeader>

          {step === 'idle' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Sube el Excel exportado del CRM. El sistema creará las campañas como{' '}
                <strong>tentativas</strong> y omitirá códigos duplicados.
              </p>

              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-3">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Compatible con el export del CRM (Donación Sangre Empresarial). Reconoce:{' '}
                  <strong>Codigo de actividad, Empresa, Municipio, Fecha/hora, Mix, Modalidad, Contacto, Ubicación</strong>.
                </p>
                <Button onClick={() => fileRef.current?.click()}>
                  Seleccionar archivo
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {parseError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {parseError}
                </p>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Se encontraron <strong>{parsedRows.length}</strong> fila(s). Revisa la vista previa antes de importar.
              </p>

              <div className="max-h-64 overflow-auto rounded-md border border-border text-xs">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {['Código', 'Empresa', 'Municipio', 'Fecha', 'Hora', 'Mix', 'Modalidad'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 50).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5 font-mono">{row.code || <span className="text-destructive">—</span>}</td>
                        <td className="px-3 py-1.5">{row.companyName || <span className="text-destructive">—</span>}</td>
                        <td className="px-3 py-1.5">{row.municipality || <span className="text-destructive">—</span>}</td>
                        <td className="px-3 py-1.5">{row.campaignDate}{row.endDate ? ` → ${row.endDate}` : ''}</td>
                        <td className="px-3 py-1.5">{row.startTime ?? '—'}{row.endTime ? `–${row.endTime}` : ''}</td>
                        <td className="px-3 py-1.5">{row.size}</td>
                        <td className="px-3 py-1.5">{row.modality}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 50 && (
                  <p className="text-center text-muted-foreground py-2">
                    … y {parsedRows.length - 50} fila(s) más
                  </p>
                )}
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => { setStep('idle'); fileRef.current?.click() }}>
                  Cambiar archivo
                </Button>
                <Button onClick={handleImport} disabled={isImporting}>
                  {isImporting ? 'Importando...' : `Importar ${parsedRows.length} campaña(s)`}
                </Button>
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">{result.imported}</p>
                  <p className="text-xs text-muted-foreground">Importadas</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <X className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-lg font-bold">{result.skipped}</p>
                  <p className="text-xs text-muted-foreground">Omitidas (duplicado)</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3">
                  <AlertCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
                  <p className="text-lg font-bold text-destructive">{result.errors.length}</p>
                  <p className="text-xs text-muted-foreground">Errores</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1 text-xs">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-destructive">
                      <strong>Fila {e.row} ({e.code}):</strong> {e.reason}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleClose}>Cerrar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
