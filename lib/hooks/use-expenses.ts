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
        })
        .select()
        .single()

      if (error) throw error
      return data as Expense
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] })
    }
  })
}
