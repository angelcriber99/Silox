require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .select('*')
    .order('date', { ascending: true });
  
  if (error) console.error(error);
  console.log(data);
}
run();
