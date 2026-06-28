import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function check() {
  const { data, error } = await supabase
    .from('transacciones')
    .select('id, tipo_operacion, cantidad, fecha, notas, activo_id, activos(ticker, tipo, nombre)')
  
  console.log(JSON.stringify(data, null, 2))
}

check()
