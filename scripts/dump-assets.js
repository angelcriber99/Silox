const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find(u => u.email === 'angelcriber99@gmail.com')
  
  // We need to fetch all assets and all transacciones to compute exact units and cost, just like posiciones_consolidadas does
  const { data: activos } = await supabase.from('activos').select('*').eq('user_id', user.id)
  const { data: txs } = await supabase.from('transacciones').select('*').eq('user_id', user.id)
  
  let totalPortfolioValue = 0;
  
  for (const activo of activos) {
    const assetTxs = txs.filter(t => t.activo_id === activo.id)
    let unidades = 0
    let coste_total = 0
    
    for (const tx of assetTxs) {
      if (tx.tipo_operacion === 'Compra' || tx.tipo_operacion === 'Traspaso Entrada') {
        unidades += tx.cantidad
        coste_total += tx.cantidad * tx.precio_unitario
      } else if (tx.tipo_operacion === 'Venta' || tx.tipo_operacion === 'Traspaso Salida') {
        unidades -= tx.cantidad
        coste_total -= tx.cantidad * tx.precio_unitario
      }
    }
    
    console.log(`[${activo.tipo}] ${activo.ticker} (${activo.nombre}): Unidades=${unidades.toFixed(4)}, Coste=${coste_total.toFixed(2)}`)
  }
}
run()
