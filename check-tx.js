const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  try {
    const { data: txs, error } = await supabase
      .from('transacciones')
      .select('*')
      .eq('activo_id', 'e4837ba3-ff22-4d77-8c58-97481d244629')
    
    if (error) throw error
    console.dir(txs, { depth: null })
  } catch (err) {
    console.error('Error:', err)
  }
}

run()
