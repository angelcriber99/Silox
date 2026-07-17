"use client"

import { useRef, useState } from "react"
import { Check, LogOut, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useQueryClient } from '@tanstack/react-query'
import type { RevolutImportTransaction } from "@/lib/domain/imports/revolut-response"
import type { SkippedImportTransaction } from "@/app/api/import/revolut/route"

interface RevolutSyncProps {
  children: React.ReactNode
  className?: string
}

export function RevolutSync({ children, className }: RevolutSyncProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importSummary, setImportSummary] = useState<{
    isOpen: boolean;
    imported: RevolutImportTransaction[];
    ignored: RevolutImportTransaction[];
    skipped: SkippedImportTransaction[];
  }>({
    isOpen: false,
    imported: [],
    ignored: [],
    skipped: []
  })

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    
    toast.promise(
      fetch('/api/import/revolut', {
        method: 'POST',
        body: formData,
      }).then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al procesar el archivo')
        
        setImportSummary({
          isOpen: true,
          imported: data.imported || [],
          ignored: data.ignored || [],
          skipped: data.skipped || []
        })

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['positions'] }),
          queryClient.invalidateQueries({ queryKey: ['net-portfolio-contributions'] }),
          queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        ])
        
        router.refresh()
        return data
      }),
      {
        loading: 'Analizando movimientos...',
        success: (data) => {
          const removed = data.removedInternalMovements
            ? ` ${data.removedInternalMovements} movimientos internos de staking limpiados.`
            : ''
          const accounting = data.accountingMovements
            ? ` ${data.accountingMovements} movimientos de efectivo conciliados.`
            : ''
          return `¡Listo! ${data.newTransactions} nuevos importados. (${data.ignoredDuplicates} ignorados por duplicidad).${accounting}${removed}`
        },
        error: (err) => err.message || 'Ocurrió un error al procesar el archivo.'
      }
    )
    
    // Reset file input
    e.target.value = ''
  }

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  return (
    <>
      <div className={`cursor-pointer ${className || ''}`} onClick={openFilePicker}>
        {children}
        <input
          ref={fileInputRef}
          type="file" 
          accept=".csv,.xlsx"
          className="hidden" 
          onChange={handleFileChange}
          onClick={(event) => event.stopPropagation()}
          aria-label="Seleccionar extracto para importar"
        />
      </div>

      <Dialog open={importSummary.isOpen} onOpenChange={(open) => setImportSummary(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Resumen de Importación</DialogTitle>
            <DialogDescription>
              Resultado de la importación de Revolut o MyInvestor
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-6">
              {importSummary.imported.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3 text-emerald-500">
                    <Check className="w-4 h-4" /> 
                    Nuevas Sincronizadas ({importSummary.imported.length})
                  </h4>
                  <div className="space-y-2">
                    {importSummary.imported.map((tx, i) => (
                      <div key={i} className="flex justify-between items-center text-sm p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{tx.ticker}</span>
                          <Badge variant="outline" className="text-[10px] h-4 leading-none px-1 border-emerald-500/30">
                            {tx.tipo_operacion}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="font-mono">
                            {tx.tipo_operacion === 'Dividendo' ? tx.precio_unitario : tx.cantidad}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tx.tipo_operacion === 'Dividendo' ? 'Dividendo' : tx.precio_unitario} {tx.moneda || '$'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importSummary.ignored.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3 text-muted-foreground">
                    <LogOut className="w-4 h-4 rotate-180" /> 
                    Ignoradas por duplicidad ({importSummary.ignored.length})
                  </h4>
                  <div className="space-y-2">
                    {importSummary.ignored.map((tx, i) => (
                      <div key={i} className="flex justify-between items-center text-sm p-2 rounded-lg bg-secondary/50 border border-border/50 opacity-60">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{tx.ticker}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-mono">{tx.cantidad}</p>
                          <p className="text-xs text-muted-foreground">{tx.fecha}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {importSummary.skipped.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3 text-rose-500">
                    <AlertTriangle className="w-4 h-4" /> 
                    Fallidas / Omitidas ({importSummary.skipped.length})
                  </h4>
                  <div className="space-y-2">
                    {importSummary.skipped.map((tx, i) => (
                      <div key={i} className="flex justify-between items-center text-sm p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{tx.ticker}</span>
                            {tx.fecha && <span className="text-xs text-muted-foreground">{tx.fecha}</span>}
                          </div>
                          <span className="text-xs text-rose-400 font-medium">{tx.reason}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {importSummary.imported.length === 0 && importSummary.ignored.length === 0 && importSummary.skipped.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No se encontraron compraventas ni dividendos en el extracto.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
