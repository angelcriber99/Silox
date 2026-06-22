import { createClient } from '@/lib/supabase/client'

export interface PriceAlert {
  id: string
  user_id: string
  ticker: string
  target_price: number
  condition: 'above' | 'below'
  triggered: boolean
  created_at: string
}

export async function fetchAlerts(): Promise<PriceAlert[]> {
  const { data, error } = await createClient()
    .from('alertas')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Error loading alerts: ${error.message}`)
  return data ?? []
}

export async function addAlert(
  data: Pick<PriceAlert, 'ticker' | 'target_price' | 'condition'>
): Promise<PriceAlert> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No estás autenticado')

  const { data: result, error } = await supabase
    .from('alertas')
    .insert([{ ...data, user_id: user.id }])
    .select()
    .single()

  if (error) throw new Error(`Error adding alert: ${error.message}`)
  return result as PriceAlert
}

export async function deleteAlert(id: string): Promise<void> {
  const { error } = await createClient()
    .from('alertas')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Error deleting alert: ${error.message}`)
}

export async function markAlertTriggered(id: string): Promise<void> {
  const { error } = await createClient()
    .from('alertas')
    .update({ triggered: true })
    .eq('id', id)

  if (error) throw new Error(`Error marking alert as triggered: ${error.message}`)
}
