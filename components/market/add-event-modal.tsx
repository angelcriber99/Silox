"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { insertEventoRecurrente, updateEventoRecurrente, deleteEventoRecurrente } from '@/lib/api/market'
import type { EnrichedPosition, EventoRecurrente } from '@/lib/types'
import { Calendar, Trash2 } from "lucide-react"

interface AddEventModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  positions: EnrichedPosition[]
  onSuccess: () => void
  initialData?: EventoRecurrente | null
}

export function AddEventModal({ open, onOpenChange, positions, onSuccess, initialData }: AddEventModalProps) {
  const [loading, setLoading] = useState(false)
  const [titulo, setTitulo] = useState(initialData?.titulo || "")
  const [tipo, setTipo] = useState(initialData?.tipo || "Interés")
  const [dia, setDia] = useState(initialData?.dia_del_mes?.toString() || "1")
  const [activoId, setActivoId] = useState(initialData?.activo_id || "")

  // Resetear estados cuando cambie initialData o open
  useEffect(() => {
    if (open) {
      setTitulo(initialData?.titulo || "")
      setTipo(initialData?.tipo || "Interés")
      setDia(initialData?.dia_del_mes?.toString() || "1")
      setActivoId(initialData?.activo_id || "")
    }
  }, [open, initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo || !activoId || !dia) return

    setLoading(true)
    try {
      if (initialData) {
        await updateEventoRecurrente(initialData.id, {
          titulo,
          tipo,
          dia_del_mes: parseInt(dia),
          activo_id: activoId,
        })
      } else {
        await insertEventoRecurrente({
          titulo,
          tipo,
          dia_del_mes: parseInt(dia),
          activo_id: activoId,
        })
      }
      
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      alert("Error al guardar el evento recurrente.")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!initialData) return
    if (!confirm("¿Seguro que quieres eliminar este evento?")) return
    
    setLoading(true)
    try {
      await deleteEventoRecurrente(initialData.id)
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      alert("Error al eliminar.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-background border border-border text-foreground shadow-2xl p-0 overflow-hidden">
        <div className="bg-gradient-to-b from-amber-500/10 to-transparent p-6 pb-2 w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Calendar className="h-5 w-5 text-amber-400" />
              {initialData ? "Editar Evento Periódico" : "Nuevo Evento Periódico"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm mt-1.5">
              Programa alertas automáticas para cobros recurrentes.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="titulo" className="text-foreground/80 font-medium">Descripción del Evento</Label>
            <Input
              id="titulo"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Cobro de Intereses Revolut"
              className="bg-card border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-amber-500/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground/80">Día del mes</Label>
              <Input
                required
                type="number"
                min="1"
                max="31"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                className="bg-card border-border text-foreground focus-visible:ring-amber-500/30"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/80">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="w-full bg-card border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="Interés">Intereses</SelectItem>
                  <SelectItem value="Aportación">Aportación</SelectItem>
                  <SelectItem value="Dividendo">Dividendo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 min-w-0">
            <Label className="text-foreground/80 font-medium">Asociar a un activo en cartera</Label>
            <Select value={activoId} onValueChange={setActivoId}>
              <SelectTrigger className="w-full bg-card border-border text-foreground">
                <SelectValue placeholder="Selecciona un activo" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground max-w-[var(--radix-select-trigger-width)]">
                {positions.map(p => (
                  <SelectItem key={p.activo_id} value={p.activo_id} className="cursor-pointer hover:bg-muted">
                    <div className="truncate max-w-[250px] sm:max-w-[300px]">
                      <span className="font-medium">{p.ticker}</span> <span className="text-muted-foreground/80 ml-1">— {p.nombre || p.tipo}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between items-center pt-5 border-t border-border/50 mt-6">
            <div>
              {initialData && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={loading}
                  className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              )}
            </div>
            <div className="flex">
              <Button
                type="button"
                variant="ghost"
                className="mr-3 text-muted-foreground hover:text-foreground"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-6 shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all"
              >
                {loading ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
