import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function run() {
  const { data: positions } = await supabase.from('posiciones').select('*')
  
  if (!positions) {
    console.log("No positions found.")
    return
  }
  
  let totalNative = 0
  
  console.log("=== Portfolio Breakdown ===")
  for (const pos of positions) {
    if (pos.tipo === 'Liquidez' || pos.tipo === 'Fondo Monetario') continue
    if (pos.unidades <= 0) continue
    
    console.log(`- ${pos.ticker} (${pos.nombre}): ${pos.unidades} units`)
  }
}
run()
