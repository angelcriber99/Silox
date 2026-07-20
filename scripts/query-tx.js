const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function run() {
  const { data, error } = await supabase.from('transacciones').select('*').limit(1)
  console.log('TX data:', data, 'error:', error)
  const { data: act, error: actError } = await supabase.from('activos').select('*').limit(1)
  console.log('ACTIVO data:', act, 'error:', actError)
}
run()
