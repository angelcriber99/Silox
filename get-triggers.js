const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('get_triggers_or_something'); // wait, there's no built in rpc for that.
  // Better yet, just use postgres. But supabase-js doesn't allow raw SQL!
}
run();
