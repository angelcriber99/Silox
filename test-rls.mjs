import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ffpvdttnmeeltsyptafm.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_wSLWks3t7_fic4mpvZAX4w_BlcT8Mo_'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function test() {
  const { data, error } = await supabase.from('posiciones').select('*')
  console.log('Posiciones (No auth):', data?.length, 'error:', error)
  
  const { data: activos, error: errAct } = await supabase.from('activos').select('*')
  console.log('Activos (No auth):', activos?.length, 'error:', errAct)
}

test()
