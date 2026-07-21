import { getSupabaseAdmin } from '../lib/supabase/admin'
import { config } from 'dotenv'
config({ path: '../.env.local' })
async function test() {
  const sb = getSupabaseAdmin()
  const { data } = await sb.from('activos').select('*').eq('ticker', 'BABA')
  console.log(data)
  if (data && data.length) {
    const { data: txs } = await sb.from('transacciones').select('*').eq('activo_id', data[0].id)
    console.log(txs)
  }
}
test()
