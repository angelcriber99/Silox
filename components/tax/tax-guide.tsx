import { AlertCircle, FileText, Scale, TrendingDown, Info } from "lucide-react"

export function TaxGuide() {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 backdrop-blur-sm space-y-6">
      <div className="flex items-center gap-3 border-b border-zinc-800/60 pb-4">
        <Scale className="h-6 w-6 text-blue-400" />
        <h2 className="text-xl font-bold text-white">Guía Fiscal Básica (España)</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Regla 1: Qué se declara */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-zinc-200 font-semibold">
            <FileText className="h-4 w-4 text-emerald-400" />
            <h3>¿Qué se declara a Hacienda?</h3>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            El simple hecho de comprar y mantener acciones o fondos <strong>no se declara</strong>. En el IRPF solo debes tributar cuando realizas una <strong>Venta</strong> (ya sea con ganancias o con pérdidas) o cuando cobras <strong>Dividendos</strong>.
          </p>
        </div>

        {/* Regla 2: Tramos */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-zinc-200 font-semibold">
            <TrendingDown className="h-4 w-4 text-rose-400" />
            <h3>Tramos del Ahorro (Ganancias)</h3>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Tus beneficios netos (Ganancias - Pérdidas) tributan en la Base Imponible del Ahorro, con los siguientes tramos progresivos aproximados:
            <br />• Hasta 6.000€: <strong>19%</strong>
            <br />• 6.000€ - 50.000€: <strong>21%</strong>
            <br />• 50.000€ - 200.000€: <strong>23%</strong>
          </p>
        </div>

        {/* Regla 3: Regla de 2 meses */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-zinc-200 font-semibold">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <h3>Regla de los 2 meses (Wash Sale)</h3>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Si vendes acciones con <strong>pérdidas</strong>, no podrás compensar fiscalmente esa pérdida si has comprado acciones idénticas de la misma empresa en los 2 meses anteriores o posteriores a la venta.
          </p>
        </div>

        {/* Regla 4: Compensación */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-zinc-200 font-semibold">
            <Info className="h-4 w-4 text-blue-400" />
            <h3>Compensación de Pérdidas</h3>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Puedes restar las pérdidas que hayas tenido de las ganancias obtenidas en el mismo año. Si aún así tienes saldo negativo, puedes guardar esas pérdidas para compensarlas con ganancias futuras durante los <strong>4 años siguientes</strong>.
          </p>
        </div>
      </div>
    </div>
  )
}
