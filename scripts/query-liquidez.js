const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function run() {
  const { data: users } = await supabase.auth.admin.listUsers()
  for (const user of users.users) {
    if (user.email === 'angelcriber99@gmail.com') {
      const { data: activos } = await supabase.from('activos').select('*').eq('user_id', user.id).eq('tipo', 'Liquidez')
      console.log(activos)
    }
  }
}
run()
