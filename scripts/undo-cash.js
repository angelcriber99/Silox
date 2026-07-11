const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { error } = await supabase.from('transacciones')
    .delete()
    .eq('notas', 'Ajuste automático para resetear liquidez negativa a 0')
  if (error) throw error
  console.log("Undone successfully")
}
run()
