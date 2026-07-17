const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  try {
    const { data: activos, error } = await supabase
      .from('activos')
      .select('*')
      .eq('ticker', 'ASTS')
    
    if (error) throw error
    console.dir(activos, { depth: null })
  } catch (err) {
    console.error('Error:', err)
  }
}

run()
