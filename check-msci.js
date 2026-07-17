const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  try {
    const userId = '64ae224e-553d-43c4-96c3-fbdff014d693'
    const { data: activos, error: err1 } = await supabase.from('activos').select('*').eq('user_id', userId).eq('isin', 'IE00BYX5P602')
    
    if (err1) throw err1
    if (!activos.length) {
      console.log('No MSCI fund found')
      return
    }
    
    const activoId = activos[0].id
    console.log('Activo ID:', activoId)
    
    const { data: txs, error: err2 } = await supabase.from('transacciones').select('*').eq('activo_id', activoId)
    if (err2) throw err2
    
    let totalInvested = 0
    let totalUnits = 0
    txs.forEach(tx => {
      if (tx.tipo_operacion === 'Compra') {
        totalInvested += (tx.cantidad * tx.precio_unitario) + tx.comision
        totalUnits += tx.cantidad
      } else if (tx.tipo_operacion === 'Venta') {
        totalInvested -= (tx.cantidad * tx.precio_unitario) - tx.comision // Simplified
        totalUnits -= tx.cantidad
      }
    })
    console.log('Total invested:', totalInvested)
    console.log('Total units:', totalUnits)
    console.log('Transactions count:', txs.length)
  } catch (err) {
    console.error('Error:', err)
  }
}

run()
