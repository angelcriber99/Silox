const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function run() {
  const { data: usuarios } = await supabase.auth.admin.listUsers()
  const user = usuarios.users.find(u => u.email === 'angelcriber99@gmail.com')
  
  const { data: activos } = await supabase.from('activos').select('*').eq('user_id', user.id).eq('tipo', 'Fondo Monetario')
  for (const a of activos) {
    const { data: txs } = await supabase.from('transacciones').select('*').eq('activo_id', a.id)
    let unidades = 0;
    for (const tx of (txs || [])) {
      if (tx.tipo_operacion === 'Compra' || tx.tipo_operacion === 'Traspaso Entrada') {
        unidades += tx.cantidad
      } else if (tx.tipo_operacion === 'Venta' || tx.tipo_operacion === 'Traspaso Salida') {
        unidades -= tx.cantidad
      }
    }
    console.log(`Fondo Monetario: ${a.ticker} - Unidades: ${unidades}`)
  }
}
run()
