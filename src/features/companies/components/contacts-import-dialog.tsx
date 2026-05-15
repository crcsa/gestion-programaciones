'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { importContacts } from '../actions/contact-actions'
import type { ImportContactsResult } from '../actions/contact-actions'
import type { ImportContactRow } from '../schemas/contact-schemas'

function normalize(v: unknown): string {
  return String(v ?? '').trim().toLowerCase()
}

function mapRow(raw: Record<string, unknown>): ImportContactRow {
  const key = (candidates: string[]): unknown => {
    for (const c of candidates) {
      for (const k of Object.keys(raw)) {
        if (normalize(k) === c) return raw[k]
      }
    }
    return undefined
  }

  return {
    companyName: String(
      key(['empresa', 'nombre empresa', 'nombre de la empresa', 'company']) ?? '',
    ).trim(),
    fullName: String(
      key(['contacto', 'nombre', 'nombre contacto', 'fullname', 'nombre completo']) ??
        '',
    ).trim(),
    position: String(
      key(['cargo', 'posicion', 'posición', 'rol', 'position']) ?? '',
    ).trim() || undefined,
    email: String(
      key(['email', 'correo', 'correo electronico', 'correo electrónico']) ?? '',
    ).trim() || undefined,
    phone: String(
      key(['telefono', 'teléfono', 'celular', 'phone']) ?? '',
    ).trim() || undefined,
    notes: String(key(['notas', 'observaciones', 'notes']) ?? '').trim() || undefined,
  }
}

interface ContactsImportDialogProps {
  onSuccess: () => void
}

type Step = 'idle' | 'preview' | 'result'

export function ContactsImportDialog({ onSuccess }: ContactsImportDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('idle')
  const [parsedRows, setParsedRows] = useState<ImportContactRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportContactsResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep('idle')
    setParsedRows([])
    setParseError(null)
    setResult(null)
  }

  const handleOpen = () => {
    reset()
    setOpen(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

        if (rawRows.length === 0) {
          setParseError('El archivo no contiene datos.')
          return
        }

        setParsedRows(rawRows.map(mapRow))
        setStep('preview')
      } catch {
        setParseError('No se pudo leer el archivo. Asegúrese de que es un Excel válido.')
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const handleImport = async () => {
    setIsImporting(true)
    try {
      const r = await importContacts(parsedRows)
      setResult(r)
      setStep('result')
      if (r.imported > 0) {
        toast.success(`${r.imported} contacto(s) importado(s)`)
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
        Importar contactos
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar contactos comerciales desde Excel</DialogTitle>
          </DialogHeader>

          {step === 'idle' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Sube el Excel del directorio. Las empresas deben existir
                previamente en el sistema (se buscan por nombre).
              </p>

              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-3">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Columnas requeridas: <strong>Empresa, Nombre</strong>. Opcionales:
                  Cargo, Email, Teléfono, Notas.
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
                Se encontraron <strong>{parsedRows.length}</strong> fila(s).
              </p>

              <div className="max-h-64 overflow-auto rounded-md border border-border text-xs">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {['Empresa', 'Nombre', 'Cargo', 'Email', 'Teléfono'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 50).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5">
                          {row.companyName || (
                            <span className="text-destructive">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {row.fullName || (
                            <span className="text-destructive">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">{row.position ?? ''}</td>
                        <td className="px-3 py-1.5">{row.email ?? ''}</td>
                        <td className="px-3 py-1.5">{row.phone ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={reset}>
                  Cambiar archivo
                </Button>
                <Button onClick={handleImport} disabled={isImporting}>
                  {isImporting
                    ? 'Importando...'
                    : `Importar ${parsedRows.length} contacto(s)`}
                </Button>
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">
                    {result.imported}
                  </p>
                  <p className="text-xs text-muted-foreground">Importados</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <X className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-lg font-bold">{result.skipped}</p>
                  <p className="text-xs text-muted-foreground">Omitidos</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3">
                  <AlertCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
                  <p className="text-lg font-bold text-destructive">
                    {result.errors.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Errores</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1 text-xs">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-destructive">
                      <strong>
                        Fila {e.row} ({e.companyName}):
                      </strong>{' '}
                      {e.reason}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setOpen(false)}>Cerrar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
