import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: 'c:/Users/angel/Documents/no tocar/work/Proyectos/Silox/.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function check() {
  const { data, error } = await supabase.from('portfolio_snapshots').select('*').order('date', { ascending: true })
  console.log(data)
}
check()
