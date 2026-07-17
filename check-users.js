const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  try {
    const { data, error } = await supabase.from('transacciones').select('user_id')
    const users = [...new Set(data.map(d => d.user_id))]
    console.log('Unique users in transacciones:', users)
    
    const { data: activos, error: err2 } = await supabase.from('activos').select('user_id')
    const userActivos = [...new Set(activos.map(d => d.user_id))]
    console.log('Unique users in activos:', userActivos)
  } catch (err) {
    console.error('Error:', err)
  }
}

run()
