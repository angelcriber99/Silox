import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization')
    const secret = process.env.WEBHOOK_SECRET

    // Require an authorization header if WEBHOOK_SECRET is set
    if (secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { amount, merchant, category, notes, user_id } = body

    if (amount === undefined || !user_id) {
      return NextResponse.json({ error: 'Missing required fields (amount, user_id)' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('expenses')
      .insert({
        user_id,
        amount: parseFloat(amount),
        merchant,
        category: category || 'General',
        notes,
        is_automated: true
      })
      .select()

    if (error) {
      console.error("Supabase insert error:", error)
      throw error
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
