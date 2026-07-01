import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

const envConfig = dotenv.parse(fs.readFileSync('.env.local'))
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function test() {
  const { data: act, error: errAct } = await supabase.from('activos').select('*').eq('id', 'c6bd8210-0249-4ba0-84e0-21c933864d8c')
  console.log("Activos by ID:", act, errAct)
}
test()
