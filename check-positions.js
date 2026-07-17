const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  try {
    const userId = '64ae224e-553d-43c4-96c3-fbdff014d693'
    
    // 1. Delete wrong transaction
    await supabase.from('transacciones').delete().eq('id', 'edf170dd-03d2-451c-bb36-a019a32c9bb8')
    
    // 2. Get correct activo for user
    const { data: activos, error: err } = await supabase.from('activos').select('*').eq('ticker', 'ADUR').eq('user_id', userId)
    if (err) throw err
    const activo = activos[0]
    
    // 3. Insert correct transaction
    const transaction = {
      user_id: userId,
      activo_id: activo.id,
      tipo_operacion: 'Compra',
      cantidad: 30.75336323,
      precio_unitario: 13.38,
      comision: 1.14,
      fecha: '2026-07-17T00:00:00Z',
      estado: 'Completada',
      notas: 'Aportación mensual, DCA...'
    }

    const { data, error } = await supabase.from('transacciones').insert(transaction).select()
    if (error) throw error
    console.log('Fixed:', data)
  } catch (err) {
    console.error('Error:', err)
  }
}

run()
