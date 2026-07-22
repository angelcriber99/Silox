import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { calculatePortfolioAccounting } from './lib/domain/portfolio/accounting-engine'

dotenv.config({ path: '.env.local' })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const { data: users } = await supabase.auth.admin.listUsers()
  
  for (const user of users.users) {
    if (!user.email?.includes('micenor88')) { // Assume this is the main user
      console.log('Analyzing user:', user.email)
      const { data: txs } = await supabase
          .from('transacciones')
          .select('id, activo_id, tipo_operacion, cantidad, precio_unitario, comision, retencion_origen, retencion_destino, fecha, created_at, notas, tipo_cambio_eur, activo:activos(ticker, tipo, moneda, nombre)')
          .eq('user_id', user.id)
          .eq('estado', 'Completada')

      const accounting = calculatePortfolioAccounting(txs as any)
      
      let totalInvested = 0
      for (const [assetId, basis] of accounting.openBases.entries()) {
        totalInvested += basis.performanceCostEur
        console.log(`- ${assetId}: ${basis.performanceCostEur.toFixed(2)} EUR`)
      }
      console.log(`TOTAL INVESTED for ${user.email}: ${totalInvested.toFixed(2)} EUR`)
    }
  }
}

run().catch(console.error)
