import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function fix() {
  const cashTxId = 'd14d775a-9510-4e52-ad64-0c4420e9c7f3'
  const parentId = '629b4ddc-ccc5-4e34-9842-52ac63a1dad8'
  
  const { error } = await supabase
    .from('transacciones')
    .update({ 
      cantidad: 1.40,
      notas: `[Auto-Cash:${parentId}] Auto-liquidez de Dividendo UNH.DE`
    })
    .eq('id', cashTxId)
    
  if (error) {
    console.error(error)
  } else {
    console.log("FIXED!")
  }
}

fix()
