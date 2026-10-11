export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      collections: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          series: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json
          id?: string
          series: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          series?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pf_accounts: {
        Row: {
          created_at: string
          currency: string
          external_ref: string | null
          id: string
          include_in_runway: boolean
          institution: string | null
          is_active: boolean
          name: string
          opening_balance: number
          opening_balance_date: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency: string
          external_ref?: string | null
          id?: string
          include_in_runway?: boolean
          institution?: string | null
          is_active?: boolean
          name: string
          opening_balance?: number
          opening_balance_date?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          external_ref?: string | null
          id?: string
          include_in_runway?: boolean
          institution?: string | null
          is_active?: boolean
          name?: string
          opening_balance?: number
          opening_balance_date?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pf_accounts_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "pf_currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      pf_budgets: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          period: string
          rollover: boolean
          starts_on: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          currency: string
          id?: string
          is_active?: boolean
          period?: string
          rollover?: boolean
          starts_on?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          period?: string
          rollover?: boolean
          starts_on?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pf_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "pf_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pf_budgets_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "pf_currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      pf_categories: {
        Row: {
          color: string | null
          created_at: string
          external_ref: string | null
          icon: string | null
          id: string
          is_archived: boolean
          kind: string
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          external_ref?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          kind: string
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          external_ref?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          kind?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pf_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pf_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      pf_currencies: {
        Row: {
          code: string
          created_at: string
          decimals: number
          is_active: boolean
          name: string
          symbol: string | null
        }
        Insert: {
          code: string
          created_at?: string
          decimals?: number
          is_active?: boolean
          name: string
          symbol?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          decimals?: number
          is_active?: boolean
          name?: string
          symbol?: string | null
        }
        Relationships: []
      }
      pf_fx_rates: {
        Row: {
          as_of_date: string
          base_code: string
          created_at: string
          id: string
          quote_code: string
          rate: number
          source: string
        }
        Insert: {
          as_of_date: string
          base_code?: string
          created_at?: string
          id?: string
          quote_code: string
          rate: number
          source?: string
        }
        Update: {
          as_of_date?: string
          base_code?: string
          created_at?: string
          id?: string
          quote_code?: string
          rate?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "pf_fx_rates_base_code_fkey"
            columns: ["base_code"]
            isOneToOne: false
            referencedRelation: "pf_currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "pf_fx_rates_quote_code_fkey"
            columns: ["quote_code"]
            isOneToOne: false
            referencedRelation: "pf_currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      pf_import_batches: {
        Row: {
          account_ref: string | null
          created_at: string
          filename: string | null
          id: string
          imported_count: number
          notes: string | null
          period_from: string | null
          period_to: string | null
          row_count: number
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_ref?: string | null
          created_at?: string
          filename?: string | null
          id?: string
          imported_count?: number
          notes?: string | null
          period_from?: string | null
          period_to?: string | null
          row_count?: number
          source: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_ref?: string | null
          created_at?: string
          filename?: string | null
          id?: string
          imported_count?: number
          notes?: string | null
          period_from?: string | null
          period_to?: string | null
          row_count?: number
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pf_profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string | null
          last_name: string | null
          nationality: string | null
          phone: string | null
          postal_code: string | null
          tax_residence: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          last_name?: string | null
          nationality?: string | null
          phone?: string | null
          postal_code?: string | null
          tax_residence?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          last_name?: string | null
          nationality?: string | null
          phone?: string | null
          postal_code?: string | null
          tax_residence?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pf_recurring: {
        Row: {
          account_id: string | null
          amount: number
          anchor_day: number | null
          category_id: string | null
          created_at: string
          currency: string
          direction: string
          end_date: string | null
          frequency: string
          id: string
          interval_n: number
          is_active: boolean
          label: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          anchor_day?: number | null
          category_id?: string | null
          created_at?: string
          currency: string
          direction: string
          end_date?: string | null
          frequency?: string
          id?: string
          interval_n?: number
          is_active?: boolean
          label: string
          start_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          anchor_day?: number | null
          category_id?: string | null
          created_at?: string
          currency?: string
          direction?: string
          end_date?: string | null
          frequency?: string
          id?: string
          interval_n?: number
          is_active?: boolean
          label?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pf_recurring_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "pf_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pf_recurring_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "pf_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pf_recurring_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "pf_currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      pf_saved_views: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_default: boolean
          kind: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          kind: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pf_settings: {
        Row: {
          base_currency: string
          created_at: string
          display_extra: string[]
          enabled_currencies: string[]
          locale: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          display_extra?: string[]
          enabled_currencies?: string[]
          locale?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          display_extra?: string[]
          enabled_currencies?: string[]
          locale?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pf_settings_base_currency_fkey"
            columns: ["base_currency"]
            isOneToOne: false
            referencedRelation: "pf_currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      pf_transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          channel: string | null
          created_at: string
          currency: string
          description: string | null
          direction: string
          external_id: string | null
          fees_amount: number
          gross_amount: number | null
          id: string
          import_batch_id: string | null
          kind: string | null
          metadata: Json
          net_amount: number | null
          occurred_on: string
          payout_date: string | null
          property: string | null
          received_on: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          channel?: string | null
          created_at?: string
          currency: string
          description?: string | null
          direction: string
          external_id?: string | null
          fees_amount?: number
          gross_amount?: number | null
          id?: string
          import_batch_id?: string | null
          kind?: string | null
          metadata?: Json
          net_amount?: number | null
          occurred_on?: string
          payout_date?: string | null
          property?: string | null
          received_on?: string | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          channel?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          direction?: string
          external_id?: string | null
          fees_amount?: number
          gross_amount?: number | null
          id?: string
          import_batch_id?: string | null
          kind?: string | null
          metadata?: Json
          net_amount?: number | null
          occurred_on?: string
          payout_date?: string | null
          property?: string | null
          received_on?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pf_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "pf_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pf_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "pf_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pf_transactions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "pf_currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "pf_transactions_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "pf_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      pf_bootstrap_user: { Args: { p_user: string }; Returns: undefined }
      pf_convert_amount: {
        Args: { p_amount: number; p_from: string; p_on?: string; p_to: string }
        Returns: number
      }
      solo_public_book: { Args: { p: Json }; Returns: Json }
      solo_public_booking: {
        Args: { p_ref: string; p_token: string }
        Returns: Json
      }
      solo_public_cancel: {
        Args: { p_reason?: string; p_ref: string; p_token: string }
        Returns: Json
      }
      solo_public_enquiry: { Args: { p: Json }; Returns: Json }
      solo_public_slots: {
        Args: { p_from: string; p_to: string; p_type: string }
        Returns: Json
      }
      solo_public_types: { Args: { p_lang?: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
