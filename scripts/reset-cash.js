const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  try {
    const { data: users, error: usersErr } = await supabase.auth.admin.listUsers()
    if (usersErr) throw usersErr
    
    for (const user of users.users) {
      const { data: assets } = await supabase
        .from('activos')
        .select('id, ticker')
        .eq('user_id', user.id)
        .eq('ticker', 'CASH')
        .single()
        
      if (!assets) continue;
      
      const { data: txs } = await supabase
        .from('transacciones')
        .select('*')
        .eq('activo_id', assets.id)
        
      let unidades = 0;
      for (const tx of (txs || [])) {
        if (tx.tipo_operacion === 'Compra' || tx.tipo_operacion === 'Traspaso Entrada') {
          unidades += tx.cantidad
        } else if (tx.tipo_operacion === 'Venta' || tx.tipo_operacion === 'Traspaso Salida') {
          unidades -= tx.cantidad
        }
      }
      
      console.log(`User ${user.email} cash balance: ${unidades}`)
      
      if (unidades < 0) {
        const amountToAdd = Math.abs(unidades)
        console.log(`Adding ${amountToAdd} to reset cash to 0...`)
        
        const { data: existingTxs } = await supabase.from('transacciones').select('tipo_operacion').limit(5)
        console.log("Allowed types:", new Set(existingTxs.map(t => t.tipo_operacion)))
        
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
  } catch (err) {
    console.error(err)
  }
}
run()
