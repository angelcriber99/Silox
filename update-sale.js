const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  try {
    const userId = '64ae224e-553d-43c4-96c3-fbdff014d693'
    const { data: activos, error: err1 } = await supabase.from('activos').select('*').eq('user_id', userId).eq('isin', 'IE00BYX5P602')
    if (err1) throw err1
    const activoId = activos[0].id
    
    // Find sale transaction
    const { data: txs, error: err2 } = await supabase.from('transacciones').select('*').eq('activo_id', activoId).eq('tipo_operacion', 'Venta')
    if (err2) throw err2
    
    const saleTx = txs[0]
    console.log('Old sale tx:', saleTx)
    
    // Update price to match 10646.39
    const newPrice = 10646.39 / saleTx.cantidad
    
    const { data: updateRes, error: err3 } = await supabase.from('transacciones').update({ precio_unitario: newPrice }).eq('id', saleTx.id).select()
    if (err3) throw err3
    
    console.log('New sale tx:', updateRes)
    
  } catch (err) {
    console.error('Error:', err)
  }
}

run()
