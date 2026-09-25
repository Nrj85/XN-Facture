/**
 * Types de la base — GÉNÉRÉ, ne pas modifier à la main.
 *
 * Régénérer après toute migration :
 *   npx supabase gen types typescript --project-id tpzmmgcfpnsysaghdqrx \
 *     --schema public > lib/db/database.types.ts
 *
 * `lib/db/types.ts` en dérive ses alias : si une colonne change de nom ou de
 * nullabilité, la compilation échoue au lieu de laisser passer un `undefined`.
 */

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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          company_id: string | null
          details: Json | null
          entity: string
          entity_id: string | null
          id: number
          occurred_at: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          company_id?: string | null
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: never
          occurred_at?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          company_id?: string | null
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: never
          occurred_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          city: string
          company_id: string
          contact_name: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          address?: string | null
          city?: string
          company_id: string
          contact_name?: string | null
          created_at?: string
          email?: string
          id?: string
          name: string
          phone?: string
        }
        Update: {
          address?: string | null
          city?: string
          company_id?: string
          contact_name?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string
          bank_account: string | null
          bank_name: string | null
          city: string
          country: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          default_notes: string | null
          email: string
          id: string
          invoice_prefix: string
          legal_name: string
          logo_data_url: string | null
          momo_mtn: string | null
          momo_orange: string | null
          name: string
          niu: string
          payment_terms_days: number
          phone: string
          rccm: string
          updated_at: string
          vat_rate: number
          vat_registered: boolean
        }
        Insert: {
          address?: string
          bank_account?: string | null
          bank_name?: string | null
          city?: string
          country?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          default_notes?: string | null
          email?: string
          id?: string
          invoice_prefix?: string
          legal_name: string
          logo_data_url?: string | null
          momo_mtn?: string | null
          momo_orange?: string | null
          name: string
          niu?: string
          payment_terms_days?: number
          phone?: string
          rccm?: string
          updated_at?: string
          vat_rate?: number
          vat_registered?: boolean
        }
        Update: {
          address?: string
          bank_account?: string | null
          bank_name?: string | null
          city?: string
          country?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          default_notes?: string | null
          email?: string
          id?: string
          invoice_prefix?: string
          legal_name?: string
          logo_data_url?: string | null
          momo_mtn?: string | null
          momo_orange?: string | null
          name?: string
          niu?: string
          payment_terms_days?: number
          phone?: string
          rccm?: string
          updated_at?: string
          vat_rate?: number
          vat_registered?: boolean
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      document_counters: {
        Row: {
          company_id: string
          kind: Database["public"]["Enums"]["document_kind"]
          last_value: number
          year: number
        }
        Insert: {
          company_id: string
          kind: Database["public"]["Enums"]["document_kind"]
          last_value?: number
          year: number
        }
        Update: {
          company_id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          last_value?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          marketing: boolean
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          marketing?: boolean
          token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          marketing?: boolean
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "admin_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          position: number
          qty_milli: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          position: number
          qty_milli: number
          unit_price: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          position?: number
          qty_milli?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          address: string
          amount_paid: number
          client_id: string
          company_id: string
          created_at: string
          due_date: string
          id: string
          issue_date: string
          notes: string | null
          number: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
          vat_exempt: boolean
          vat_rate: number
        }
        Insert: {
          address?: string
          amount_paid?: number
          client_id: string
          company_id: string
          created_at?: string
          due_date: string
          id?: string
          issue_date: string
          notes?: string | null
          number?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          vat_exempt?: boolean
          vat_rate: number
        }
        Update: {
          address?: string
          amount_paid?: number
          client_id?: string
          company_id?: string
          created_at?: string
          due_date?: string
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          vat_exempt?: boolean
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "admin_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          description: string
          id: string
          position: number
          qty_milli: number
          quote_id: string
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          position: number
          qty_milli: number
          quote_id: string
          unit_price: number
        }
        Update: {
          description?: string
          id?: string
          position?: number
          qty_milli?: number
          quote_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          address: string
          client_id: string
          company_id: string
          created_at: string
          id: string
          invoice_id: string | null
          issue_date: string
          notes: string | null
          number: string | null
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
          valid_until: string
          vat_exempt: boolean
          vat_rate: number
        }
        Insert: {
          address?: string
          client_id: string
          company_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          issue_date: string
          notes?: string | null
          number?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          valid_until: string
          vat_exempt?: boolean
          vat_rate: number
        }
        Update: {
          address?: string
          client_id?: string
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          issue_date?: string
          notes?: string | null
          number?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          valid_until?: string
          vat_exempt?: boolean
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_orders: {
        Row: {
          company_id: string
          created_at: string
          id: string
          payment_links: Json | null
          period: Database["public"]["Enums"]["billing_period"]
          plan: Database["public"]["Enums"]["plan_code"]
          provider: string | null
          reference: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          payment_links?: Json | null
          period: Database["public"]["Enums"]["billing_period"]
          plan: Database["public"]["Enums"]["plan_code"]
          provider?: string | null
          reference: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          payment_links?: Json | null
          period?: Database["public"]["Enums"]["billing_period"]
          plan?: Database["public"]["Enums"]["plan_code"]
          provider?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          channel: string
          company_id: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          period_end: string | null
          period_start: string | null
          plan: Database["public"]["Enums"]["plan_code"]
          provider: string
          provider_reference: string
          status: string
        }
        Insert: {
          amount: number
          channel: string
          company_id: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          period_end?: string | null
          period_start?: string | null
          plan: Database["public"]["Enums"]["plan_code"]
          provider: string
          provider_reference: string
          status: string
        }
        Update: {
          amount?: number
          channel?: string
          company_id?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          period_end?: string | null
          period_start?: string | null
          plan?: Database["public"]["Enums"]["plan_code"]
          provider?: string
          provider_reference?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_reminders: {
        Row: {
          company_id: string
          expires_at: string
          id: string
          kind: string
          recipient: string
          request_id: number | null
          sent_at: string
        }
        Insert: {
          company_id: string
          expires_at: string
          id?: string
          kind: string
          recipient: string
          request_id?: number | null
          sent_at?: string
        }
        Update: {
          company_id?: string
          expires_at?: string
          id?: string
          kind?: string
          recipient?: string
          request_id?: number | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_reminders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string | null
          plan: Database["public"]["Enums"]["plan_code"]
          renewal_declined: boolean
          requested: Database["public"]["Enums"]["plan_code"] | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at?: string | null
          plan?: Database["public"]["Enums"]["plan_code"]
          renewal_declined?: boolean
          requested?: Database["public"]["Enums"]["plan_code"] | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string | null
          plan?: Database["public"]["Enums"]["plan_code"]
          renewal_declined?: boolean
          requested?: Database["public"]["Enums"]["plan_code"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_actors: {
        Row: {
          created_at: string | null
          email: string | null
          email_confirme: boolean | null
          id: string | null
          last_sign_in_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          email_confirme?: never
          id?: string | null
          last_sign_in_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          email_confirme?: never
          id?: string | null
          last_sign_in_at?: string | null
        }
        Relationships: []
      }
      subscription_reminders_status: {
        Row: {
          company_id: string | null
          error_msg: string | null
          expires_at: string | null
          id: string | null
          kind: string | null
          recipient: string | null
          sent_at: string | null
          status_code: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_reminders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      attach_payment_links: {
        Args: { p_links: Json; p_provider: string; p_reference: string }
        Returns: undefined
      }
      cancel_subscription_order: { Args: never; Returns: undefined }
      create_company_for_current_user: {
        Args: { p_legal_name?: string; p_name: string }
        Returns: string
      }
      current_company_id: { Args: never; Returns: string }
      is_company_member: { Args: { p_company: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      marketing_recipients: {
        Args: never
        Returns: {
          marketing: boolean
          token: string
          user_id: string
        }[]
      }
      next_document_number: {
        Args: {
          p_company: string
          p_kind: Database["public"]["Enums"]["document_kind"]
          p_prefix: string
          p_year: number
        }
        Returns: string
      }
      plan_label: {
        Args: { p: Database["public"]["Enums"]["plan_code"] }
        Returns: string
      }
      request_plan: { Args: { p_plan: string }; Returns: undefined }
      send_expiry_reminders: { Args: never; Returns: number }
      set_marketing_preference: {
        Args: { p_accept: boolean; p_token: string }
        Returns: string
      }
      set_renewal_intent: { Args: { p_renew: boolean }; Returns: undefined }
      start_subscription_order: {
        Args: { p_period: string; p_plan: string }
        Returns: string
      }
    }
    Enums: {
      billing_period: "monthly" | "yearly"
      currency_code: "XAF" | "XOF"
      document_kind: "invoice" | "quote"
      invoice_status: "draft" | "sent" | "partially_paid" | "paid" | "cancelled"
      member_role: "owner" | "admin" | "member"
      order_status: "pending" | "paid" | "cancelled"
      plan_code: "discovery" | "pro" | "business"
      quote_status: "draft" | "sent" | "accepted" | "refused"
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
    Enums: {
      billing_period: ["monthly", "yearly"],
      currency_code: ["XAF", "XOF"],
      document_kind: ["invoice", "quote"],
      invoice_status: ["draft", "sent", "partially_paid", "paid", "cancelled"],
      member_role: ["owner", "admin", "member"],
      order_status: ["pending", "paid", "cancelled"],
      plan_code: ["discovery", "pro", "business"],
      quote_status: ["draft", "sent", "accepted", "refused"],
    },
  },
} as const
