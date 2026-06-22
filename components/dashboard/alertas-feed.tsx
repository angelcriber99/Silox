"use client"

import { useAlertas } from "@/lib/hooks/use-alertas"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { BellRing, MessageSquare, ExternalLink, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function AlertasFeed() {
  const { data: alertas, isLoading } = useAlertas()

  if (isLoading) {
    return (
      <Card className="col-span-1 border-muted/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BellRing className="h-4 w-4 text-emerald-500" />
            Señales (The Long Investor)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-12 w-full bg-muted/50 rounded animate-pulse" />
          <div className="h-12 w-full bg-muted/50 rounded animate-pulse" />
          <div className="h-12 w-full bg-muted/50 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (!alertas || alertas.length === 0) {
    return (
      <Card className="col-span-1 border-muted/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BellRing className="h-4 w-4 text-emerald-500" />
            Señales (The Long Investor)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay alertas recientes.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="col-span-1 border-muted/50 bg-card/50 h-[400px] flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-emerald-500" />
            Señales (The Long Investor)
          </div>
          <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-full font-semibold">
            EN DIRECTO
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 overflow-y-auto pr-2 pb-6">
        {alertas.map((alerta) => (
          <div
            key={alerta.id}
            className={`p-3 rounded-lg border text-sm ${
              alerta.tipo === 'chat'
                ? alerta.accion === 'BUY'
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-rose-500/5 border-rose-500/20'
                : 'bg-muted/50 border-muted'
            }`}
          >
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center gap-2 font-semibold">
                {alerta.tipo === 'chat' ? (
                  <>
                    {alerta.accion === 'BUY' ? (
                      <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-rose-500" />
                    )}
                    <span className={alerta.accion === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}>
                      {alerta.accion} {alerta.ticker}
                    </span>
                    {alerta.precio && (
                      <span className="text-muted-foreground font-normal">
                        @ ${alerta.precio}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 text-blue-400" />
                    <span className="text-blue-400">
                      {alerta.ticker ? `POST: $${alerta.ticker}` : 'NUEVO POST'}
                    </span>
                  </>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                {formatDistanceToNow(new Date(alerta.fecha), { addSuffix: true, locale: es })}
              </span>
            </div>
            
            {alerta.tipo === 'post' && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {alerta.texto_original}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
