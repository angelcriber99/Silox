import { getSupabaseAdmin } from '../lib/supabase/admin'
import { config } from 'dotenv'
config({ path: '../.env.local' })

async function main() {
  const supabase = getSupabaseAdmin()
  console.log("Updating BABA transaction dates to June 10, 2026...")
  const { data: activos } = await supabase.from('activos').select('id').eq('ticker', 'BABA')
  if (!activos || activos.length === 0) return console.log("No BABA asset found")
  
  const activoId = activos[0].id
  const { data, error } = await supabase.from('transacciones')
    .update({ fecha: '2026-06-10' })
    .eq('activo_id', activoId)
    .eq('tipo_operacion', 'Compra')
    
  if (error) console.error(error)
  else console.log("Success! Dates updated.")
}
main();
