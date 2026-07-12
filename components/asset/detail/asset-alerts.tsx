import { useAlerts } from "@/lib/hooks/use-alerts"
import { Bell, BellRing, Target, Plus, CheckCircle2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils/formatters"
import { Button } from "@/components/ui/button"

interface AssetAlertsProps {
  ticker: string
  moneda: string
  onOpenAlertsModal: () => void
}

export function AssetAlerts({ ticker, moneda, onOpenAlertsModal }: AssetAlertsProps) {
  const { alerts, removeAlert } = useAlerts()
  
  const assetAlerts = alerts.filter(a => a.ticker.toUpperCase() === ticker.toUpperCase())
  const activeAlerts = assetAlerts.filter(a => !a.triggered)
  const triggeredAlerts = assetAlerts.filter(a => a.triggered)

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-amber-500/10 p-2 rounded-lg">
            <Bell className="h-5 w-5 text-amber-500" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Alertas de Precio</h3>
        </div>
        <Button 
          onClick={onOpenAlertsModal}
          size="sm" 
          variant="outline" 
          className="h-8 gap-1.5 border-border bg-background text-foreground/80 hover:text-foreground hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" />
          Nueva Alerta
        </Button>
      </div>

      {assetAlerts.length === 0 ? (
        <div className="text-center py-6">
          <Target className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No tienes alertas configuradas para {ticker}.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Te avisaremos si el precio alcanza tu objetivo.
          </p>
        </div>
      ) : (
        <div className="space-y-2 mt-4">
          {activeAlerts.map(alert => (
            <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {alert.condition === 'above' ? 'Sube por encima de' : 'Baja por debajo de'}
                </span>
                <span className="text-xs text-muted-foreground/80">
                  Notificación push y sonido
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold text-foreground tabular-nums">
                  {formatCurrency(alert.target_price, moneda)}
                </span>
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="text-muted-foreground/50 hover:text-rose-400 transition-colors p-1"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}

          {triggeredAlerts.map(alert => (
            <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-emerald-500/90">
                    Alerta disparada
                  </span>
                  <span className="text-xs text-emerald-500/60">
                    {alert.condition === 'above' ? 'Superó' : 'Cayó a'} {formatCurrency(alert.target_price, moneda)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => removeAlert(alert.id)}
                className="text-emerald-500/50 hover:text-emerald-500 transition-colors p-1"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
