export type CategoryGroup = 'taxes' | 'bills' | 'living' | 'goals' | 'investments' | 'lifestyle'
export type DueFrequency = 'monthly' | 'quarterly' | 'annual' | 'one_time' | 'none'

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          group_name: CategoryGroup
          target_amount: number
          current_balance: number
          priority: number
          due_date: string | null
          due_frequency: DueFrequency
          notes: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
      income_events: {
        Row: {
          id: string
          user_id: string
          amount: number
          source: string
          received_at: string
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['income_events']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['income_events']['Insert']>
      }
      allocations: {
        Row: {
          id: string
          income_event_id: string
          category_id: string
          suggested_amount: number
          confirmed_amount: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['allocations']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['allocations']['Insert']>
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          category_id: string
          amount: number
          description: string
          date: string
          allocation_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          tax_carveout_percent: number
          currency: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_settings']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['user_settings']['Insert']>
      }
    }
  }
}

export type Category = Database['public']['Tables']['categories']['Row']
export type IncomeEvent = Database['public']['Tables']['income_events']['Row']
export type Allocation = Database['public']['Tables']['allocations']['Row']
export type Transaction = Database['public']['Tables']['transactions']['Row']
export type UserSettings = Database['public']['Tables']['user_settings']['Row']

export interface Account {
  id: string
  user_id: string
  name: string
  type: string
  balance: number
  credit_limit: number | null
  interest_rate: number | null
  contribution_room: number | null
  yearly_contribution_limit: number | null
  contributions_ytd: number
  payment_category_id: string | null
  notes: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface AccountTransfer {
  id: string
  user_id: string
  from_account_id: string
  to_account_id: string
  amount: number
  date: string
  description: string | null
  transaction_id: string | null
  created_at: string
}
