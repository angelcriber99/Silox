import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ffpvdttnmeeltsyptafm.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_wSLWks3t7_fic4mpvZAX4w_BlcT8Mo_'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function test() {
  const { data, error } = await supabase.from('pg_class').select('*').limit(1).catch(() => ({error: 'Not allowed'}))
  console.log('Can access pg_class?', error ? 'No' : 'Yes')
}

test()
