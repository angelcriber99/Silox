const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { data, error } = await supabase.rpc('get_schema_info')
  console.log("If this fails, we will just fetch one row and see its type:")
  const { data: row } = await supabase.from('transacciones').select('tipo_operacion').limit(20)
  console.log(new Set(row.map(r => r.tipo_operacion)))
}
run()
