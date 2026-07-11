const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { data: users } = await supabase.auth.admin.listUsers()
  for (const user of users.users) {
    const { data: pos } = await supabase
      .from('posiciones_consolidadas')
      .select('*')
      .eq('ticker', 'CASH')
    console.log(pos)
  }
}
run()
