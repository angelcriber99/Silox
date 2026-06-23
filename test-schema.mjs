import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ffpvdttnmeeltsyptafm.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_wSLWks3t7_fic4mpvZAX4w_BlcT8Mo_'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function test() {
  const { data, error } = await supabase.from('activos').select('*').limit(1)
  console.log('Sample Activo:', data)
}

test()
