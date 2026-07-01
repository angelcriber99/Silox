import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

const envConfig = dotenv.parse(fs.readFileSync('.env.local'))

const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function test() {
  const { data, error } = await supabase.from('posiciones').select('*').eq('ticker', 'GRRR')
  console.log("Posicion GRRR:", data, error)
  const { data: act, error: errAct } = await supabase.from('activos').select('notas').eq('ticker', 'GRRR')
  console.log("Notas GRRR:", act, errAct)
}
test()
