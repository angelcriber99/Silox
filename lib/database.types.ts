export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      activos: {
        Row: {
          id: string
          user_id: string
          ticker: string
          isin: string | null
          nombre: string | null
          tipo: string
          estrategia: string
          moneda: string
          sector: string
          geografia: string
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ticker: string
          isin?: string | null
          nombre?: string | null
          tipo: string
          estrategia: string
          moneda: string
          sector?: string
          geografia?: string
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ticker?: string
          isin?: string | null
          nombre?: string | null
          tipo?: string
          estrategia?: string
          moneda?: string
          sector?: string
          geografia?: string
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activos_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      posiciones: {
        Row: {
          user_id: string
          activo_id: string
          ticker: string
          isin: string | null
          nombre: string | null
          tipo: string
          estrategia: string
          moneda: string
          sector: string
          geografia: string
          notas: string | null
          unidades: number
          coste_total: number
          comisiones_total: number
          num_operaciones: number
          ultima_operacion: string | null
        }
        Insert: {
          user_id: string
          activo_id: string
          ticker: string
          isin?: string | null
          nombre?: string | null
          tipo: string
          estrategia: string
          moneda: string
          sector?: string
          geografia?: string
          notas?: string | null
          unidades?: number
          coste_total?: number
          comisiones_total?: number
          num_operaciones?: number
          ultima_operacion?: string | null
        }
        Update: {
          user_id?: string
          activo_id?: string
          ticker?: string
          isin?: string | null
          nombre?: string | null
          tipo?: string
          estrategia?: string
          moneda?: string
          sector?: string
          geografia?: string
          notas?: string | null
          unidades?: number
          coste_total?: number
          comisiones_total?: number
          num_operaciones?: number
          ultima_operacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posiciones_activo_id_fkey"
            columns: ["activo_id"]
            referencedRelation: "activos"
            referencedColumns: ["id"]
          }
        ]
      }
      transacciones: {
        Row: {
          id: string
          user_id: string
          activo_id: string
          tipo_operacion: string
          cantidad: number
          precio_unitario: number
          comision: number
          fecha: string
          notas: string | null
          created_at: string
          estado: string
          linked_transaction_id: string | null
          retencion_origen: number | null
          retencion_destino: number | null
        }
        Insert: {
          id?: string
          user_id: string
          activo_id: string
          tipo_operacion: string
          cantidad: number
          precio_unitario: number
          comision?: number
          fecha: string
          notas?: string | null
          created_at?: string
          estado?: string
          linked_transaction_id?: string | null
          retencion_origen?: number | null
          retencion_destino?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          activo_id?: string
          tipo_operacion?: string
          cantidad?: number
          precio_unitario?: number
          comision?: number
          fecha?: string
          notas?: string | null
          created_at?: string
          estado?: string
          linked_transaction_id?: string | null
          retencion_origen?: number | null
          retencion_destino?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transacciones_activo_id_fkey"
            columns: ["activo_id"]
            referencedRelation: "activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacciones_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacciones_linked_transaction_id_fkey"
            columns: ["linked_transaction_id"]
            referencedRelation: "transacciones"
            referencedColumns: ["id"]
          }
        ]
      }
      portfolio_snapshots: {
        Row: {
          id: string
          user_id: string
          date: string
          total_value: number
          total_invested: number
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          total_value: number
          total_invested: number
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          total_value?: number
          total_invested?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_snapshots_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      eventos_recurrentes: {
        Row: {
          id: string
          user_id: string
          activo_id: string
          titulo: string
          dia_del_mes: number
          tipo: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          activo_id: string
          titulo: string
          dia_del_mes: number
          tipo: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          activo_id?: string
          titulo?: string
          dia_del_mes?: number
          tipo?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_recurrentes_activo_id_fkey"
            columns: ["activo_id"]
            referencedRelation: "activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_recurrentes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      alertas: {
        Row: {
          id: string
          user_id: string
          ticker: string
          target_price: number
          condition: 'above' | 'below'
          triggered: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ticker: string
          target_price: number
          condition: 'above' | 'below'
          triggered?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ticker?: string
          target_price?: number
          condition?: 'above' | 'below'
          triggered?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      notification_preferences: {
        Row: {
          user_id: string
          push_notifs: boolean
          email_notifs: boolean
          price_alerts: boolean
          weekly_report: boolean
          dividend_alerts: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          push_notifs?: boolean
          email_notifs?: boolean
          price_alerts?: boolean
          weekly_report?: boolean
          dividend_alerts?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          push_notifs?: boolean
          email_notifs?: boolean
          price_alerts?: boolean
          weekly_report?: boolean
          dividend_alerts?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      imports: {
        Row: {
          id: string
          user_id: string
          source: string
          filename: string
          file_size: number
          file_type: string | null
          status: 'processing' | 'completed' | 'failed'
          parsed_count: number
          imported_count: number
          updated_count: number
          ignored_count: number
          removed_internal_movements: number
          error: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          source: string
          filename: string
          file_size: number
          file_type?: string | null
          status: 'processing' | 'completed' | 'failed'
          parsed_count?: number
          imported_count?: number
          updated_count?: number
          ignored_count?: number
          removed_internal_movements?: number
          error?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          source?: string
          filename?: string
          file_size?: number
          file_type?: string | null
          status?: 'processing' | 'completed' | 'failed'
          parsed_count?: number
          imported_count?: number
          updated_count?: number
          ignored_count?: number
          removed_internal_movements?: number
          error?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imports_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      budget_settings: {
        Row: {
          id: string
          user_id: string
          monthly_allowance: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          monthly_allowance?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          monthly_allowance?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_settings_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      expenses: {
        Row: {
          id: string
          user_id: string
          amount: number
          merchant: string
          category: string
          date: string
          notes: string | null
          is_automated: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          merchant: string
          category: string
          date?: string
          notes?: string | null
          is_automated?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          merchant?: string
          category?: string
          date?: string
          notes?: string | null
          is_automated?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_transaction_with_cash: {
        Args: {
          p_transaction: Json
          p_cash_operation?: string | null
          p_cash_amount?: number | null
        }
        Returns: Database['public']['Tables']['transacciones']['Row']
      }
      update_transaction_with_cash: {
        Args: {
          p_transaction_id: string
          p_transaction: Json
          p_cash_operation?: string | null
          p_cash_amount?: number | null
        }
        Returns: Database['public']['Tables']['transacciones']['Row']
      }
      create_fund_transfer: {
        Args: {
          p_source_transaction: Json
          p_destination_transaction: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
