import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export type Expense = {
  id: string
  user_id: string
  amount: number
  category: string
  merchant: string
  date: string
  notes: string | null
  is_automated: boolean
  created_at: string
}

export type BudgetSettings = {
  id: string
  user_id: string
  monthly_allowance: number
  updated_at: string
}

export function useBudgetSettings() {
  const supabase = createClient()
  
  return useQuery({
    queryKey: ["budget-settings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No user")
        
      const { data, error } = await supabase
        .from("budget_settings")
        .select("*")
        .eq("user_id", user.id)
        .single()
        
      if (error && error.code !== 'PGRST116') throw error
      return data as BudgetSettings | null
    },
  })
}

export function useSaveBudgetSettings() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (allowance: number) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No user")

      const { data, error } = await supabase
        .from("budget_settings")
        .upsert({
          user_id: user.id,
          monthly_allowance: allowance,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select()
        .single()

      if (error) throw error
      return data as BudgetSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-settings"] })
    }
  })
}

export function useExpenses(month?: string) {
  const supabase = createClient()
  
  return useQuery({
    queryKey: ["expenses", month],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No user")

      let query = supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })

      if (month) {
        const startDate = new Date(`${month}-01T00:00:00Z`).toISOString()
        const endDate = new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)).toISOString()
        query = query.gte("date", startDate).lt("date", endDate)
      }

      const { data, error } = await query
      
      if (error) throw error
      return data as Expense[]
    },
  })
}

export function useAddExpense() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (expense: Partial<Expense>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No user")

      const { data, error } = await supabase
        .from("expenses")
        .insert({
          ...expense,
          user_id: user.id,
        } as any)
        .select()
        .single()

      if (error) throw error
      return data as Expense
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] })
      queryClient.invalidateQueries({ queryKey: ["global-balance"] })
    }
  })
}

export function useGlobalBalance() {
  const supabase = createClient()
  return useQuery({
    queryKey: ["global-balance"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No user")
      
      const { data, error } = await supabase
        .from("expenses")
        .select("amount")
        .eq("user_id", user.id)
        
      if (error) throw error
      
      // Sum all expenses (positive) and incomes (negative)
      const sum = data.reduce((acc, row) => acc + row.amount, 0)
      
      // Available balance is the inverse of the sum 
      // (If incomes > expenses, sum is negative, so balance is positive)
      return -sum
    }
  })
}

export function useTransferToInvestments() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (amount: number) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No user")
      
      // 1. Add expense
      const { error: expError } = await supabase.from("expenses").insert({
        user_id: user.id,
        amount: amount, // Positive amount = expense
        category: "Inversión",
        merchant: "Traspaso a Inversiones",
        date: new Date().toISOString(),
        is_automated: true
      } as any)
      if (expError) throw expError

      // 2. Get or create CASH asset
      const { data: existingAsset, error: searchError } = await supabase
        .from('activos')
        .select('*')
        .eq('user_id', user.id)
        .eq('tipo', 'Liquidez')
        .limit(1)
        .single()

      let assetId = existingAsset?.id

      if (!assetId) {
        const { data: newAsset, error: insertAssetError } = await supabase
          .from('activos')
          .insert([{
            user_id: user.id,
            ticker: 'CASH',
            nombre: 'Efectivo',
            tipo: 'Liquidez',
            estrategia: 'Liquidez',
            moneda: 'EUR'
          }])
          .select()
          .single()
          
        if (insertAssetError) throw insertAssetError
        assetId = newAsset.id
      }

      // 3. Insert transaction
      const { error: txError } = await supabase
        .from('transacciones')
        .insert([{
          user_id: user.id,
          activo_id: assetId,
          tipo_operacion: 'Compra',
          cantidad: amount,
          precio_unitario: 1,
          fecha: new Date().toISOString(),
          comision: 0
        }])

      if (txError) throw txError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] })
      queryClient.invalidateQueries({ queryKey: ["global-balance"] })
      queryClient.invalidateQueries({ queryKey: ["positions"] })
    }
  })
}
