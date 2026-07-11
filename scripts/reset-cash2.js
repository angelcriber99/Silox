const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { data: users } = await supabase.auth.admin.listUsers()
  
  for (const user of users.users) {
    const { data: txs } = await supabase
      .from('transacciones')
      .select('*, activo:activos(ticker)')
      .eq('user_id', user.id)
      
    if (!txs || txs.length === 0) continue;
    
    let cashBalance = 0;
    
    for (const tx of txs) {
      const isCash = tx.activo?.ticker === 'CASH';
      const amount = tx.cantidad * tx.precio_unitario;
      
      if (isCash) {
        if (tx.tipo_operacion === 'Compra' || tx.tipo_operacion === 'Traspaso Entrada') {
          cashBalance += amount;
        } else if (tx.tipo_operacion === 'Venta' || tx.tipo_operacion === 'Traspaso Salida') {
          cashBalance -= amount;
        }
      } else {
        if (tx.tipo_operacion === 'Compra') {
          cashBalance -= amount;
        } else if (tx.tipo_operacion === 'Venta') {
          cashBalance += amount;
        } else if (tx.tipo_operacion === 'Dividendo') {
          cashBalance += amount;
        }
      }
    }
    
    console.log(`User ${user.email} calculated cash balance: ${cashBalance}`)
    
    if (cashBalance < 0) {
      const amountToAdd = Math.abs(cashBalance)
      console.log(`Adding ${amountToAdd} to reset cash to 0...`)
      
      const { data: assets } = await supabase
        .from('activos')
        .select('id')
        .eq('user_id', user.id)
        .eq('ticker', 'CASH')
        .single()
        
      if (!assets) {
        console.log(`User ${user.email} has no CASH asset, skipping...`);
        continue;
      }
        
      const { error: insertErr } = await supabase.from('transacciones').insert([{
        user_id: user.id,
        activo_id: assets.id,
        tipo_operacion: 'Compra',
        fecha: new Date().toISOString().split('T')[0],
        cantidad: amountToAdd,
        precio_unitario: 1,
        comision: 0,
        estado: 'Completada',
        notas: 'Ajuste automático para resetear liquidez negativa a 0'
      }])
      
      if (insertErr) throw insertErr
      console.log('Reset successful!')
    }
  }
}
run()
