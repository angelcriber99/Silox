import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

for (const line of env.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].replace(/['"]/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].replace(/['"]/g, '').trim();
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('transacciones')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(5);
    
  console.log("Error:", error);
  console.log("Latest transactions:");
  console.table(data);
  
  // also get the total invested from the user's stats
  const { data: stats, error: statsError } = await supabase
    .from('portfolio_stats')
    .select('*')
    .limit(1);
    
  console.log("Stats Error:", statsError);
  console.log("Portfolio Stats:");
  console.table(stats);
}
run();
