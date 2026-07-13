"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BookOpen, Lightbulb, TrendingUp, ShieldAlert, DollarSign } from "lucide-react"

interface HelpGuideModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HelpGuideModal({ open, onOpenChange }: HelpGuideModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-background/95 backdrop-blur-xl border-border/50 max-h-[85vh] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b border-border/50 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <BookOpen className="w-6 h-6 text-amber-500" />
            Guía de Uso Rápido
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Aprende a sacarle el máximo partido a tu portfolio en Silox.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-8 pr-2">
            
            <section className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <Lightbulb className="w-5 h-5 text-blue-400" />
                Cómo añadir tu primer activo
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Pulsa el botón azul <strong>«+ Añadir Activo»</strong> en la tabla. Deberás introducir el <em>Ticker</em> (ej: AAPL para Apple, o el ISIN para fondos indexados) y seleccionar su tipo.
                <br /><br />
                Una vez añadido a tu tabla, tendrás que añadirle <strong>Transacciones</strong> pulsando el icono del más (<span className="inline-block align-middle"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg></span>) en esa fila. Introduce cuántas unidades has comprado o vendido y a qué precio medio.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <ShieldAlert className="w-5 h-5 text-cyan-400" />
                El truco de los Fondos Monetarios
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Si utilizas <strong>Fondos Monetarios</strong> (como liquidez remunerada), puedes añadirlos con el tipo «Fondo Monetario».
                Dado que los monetarios crecen de forma constante acumulando intereses, la mejor forma de registrarlos para no distorsionar tu rentabilidad P&L es:
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>Registrar la compra con <strong>precio unitario = 1</strong> (relación 1 a 1 con el Euro).</li>
                <li>Registrar el <strong>Ticker</strong> o nombre que quieras para identificarlo.</li>
                <li>Con esto, verás su valor actual estable sin generar una «rentabilidad falsa» por acumulación en el P&L, actuando como puro efectivo (Cash).</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Dividendos y Eventos
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Puedes cobrar dividendos directamente registrándolos en la ventana de transacciones del activo (opción «Dividendo»). Ese importe sumará a la métrica de ganancias realizadas de tu dashboard global, permitiendo trackear ingresos pasivos.
                También puedes usar el panel de <strong>Próximos Eventos</strong> para apuntar de manera manual vencimientos de depósitos, letras del tesoro o fechas de ex-dividend.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <DollarSign className="w-5 h-5 text-violet-400" />
                Alertas de Precio
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Añade alertas en el panel derecho introduciendo el Ticker y tu Precio Objetivo. Silox comprobará el precio en tiempo real y emitirá una notificación de navegador (asegúrate de darle permisos de notificación) y un aviso sonoro si cruza la barrera.
              </p>
            </section>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
