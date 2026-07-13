"use client"

import { useState } from "react"
import { Check, LogOut } from "lucide-react"
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
import { useQueryClient } from "@tanstack/react-query"

interface ImportPreviewTransaction {
  ticker: string
  tipo_operacion: string
  cantidad: number
  precio_unitario: number
  fecha: string
}

interface RevolutSyncProps {
  children: React.ReactNode
  className?: string
}

export function RevolutSync({ children, className }: RevolutSyncProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [importSummary, setImportSummary] = useState<{
    isOpen: boolean
    imported: ImportPreviewTransaction[]
    ignored: ImportPreviewTransaction[]
    updatedTransactions: number
    importId: string | null
  }>({
    isOpen: false,
    imported: [],
    ignored: [],
    updatedTransactions: 0,
    importId: null,
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
        if (!res.ok) {
          const suffix = data.requestId ? ` (${data.requestId})` : ''
          throw new Error(`${data.error || 'Error al procesar el archivo'}${suffix}`)
        }
        
        setImportSummary({
          isOpen: true,
          imported: data.imported || [],
          ignored: data.ignored || [],
          updatedTransactions: data.updatedTransactions || 0,
          importId: data.importId || null,
        })
        
        queryClient.invalidateQueries({ queryKey: ["imports"] })
        router.refresh()
        return data
      }),
      {
        loading: 'Analizando movimientos...',
        success: (data) => {
          const removed = data.removedInternalMovements
            ? ` ${data.removedInternalMovements} movimientos internos de staking limpiados.`
            : ''
          const updated = data.updatedTransactions
            ? ` ${data.updatedTransactions} históricos actualizados.`
            : ''
          return `¡Listo! ${data.newTransactions} nuevos importados. (${data.ignoredDuplicates} ignorados por duplicidad).${updated}${removed}`
        },
        error: (err) => err.message || 'Ocurrió un error al procesar el archivo.'
      }
    )
    
    // Reset file input
    e.target.value = ''
  }

  return (
    <>
      <label className={`cursor-pointer ${className || ''}`}>
        {children}
        <input 
          type="file" 
          accept=".csv,.xlsx"
          className="hidden" 
          onChange={handleFileChange}
        />
      </label>

      <Dialog open={importSummary.isOpen} onOpenChange={(open) => setImportSummary(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Resumen de Importación</DialogTitle>
            <DialogDescription>
              Resultados de la sincronización de tu extracto
              {importSummary.importId ? ` · ID ${importSummary.importId.slice(0, 8)}` : ''}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-6">
              {importSummary.imported.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3 text-emerald-500">
                    <Check className="w-4 h-4" /> 
                    Sincronizadas ({importSummary.imported.length})
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
                          <p className="font-mono">{tx.cantidad}</p>
                          <p className="text-xs text-muted-foreground">{tx.precio_unitario}$</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importSummary.updatedTransactions > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-500">
                  {importSummary.updatedTransactions} operaciones de metales se actualizaron con precios históricos recalculados.
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
              
              {importSummary.imported.length === 0 && importSummary.ignored.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No se encontraron operaciones de compra/venta en el extracto.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
