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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      other_receipts: {
        Row: {
          deleted_at: string | null
          deleted_by: string | null
          delete_reason: string | null
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          date: string
          display_id: string | null
          id: string
          kind: string
          notes: string | null
          payer: string | null
          payment_mode: string
          reference: string | null
        }
        Insert: {
          deleted_at?: string | null
          deleted_by?: string | null
          delete_reason?: string | null
          amount: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          display_id?: string | null
          id?: string
          kind: string
          notes?: string | null
          payer?: string | null
          payment_mode?: string
          reference?: string | null
        }
        Update: {
          deleted_at?: string | null
          deleted_by?: string | null
          delete_reason?: string | null
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          display_id?: string | null
          id?: string
          kind?: string
          notes?: string | null
          payer?: string | null
          payment_mode?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "other_receipts_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "other_receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      account_month_balances: {
        Row: {
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          id: string
          updated_at: string
          balance: number
          month: string
        }
        Insert: {
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
          balance: number
          month: string
        }
        Update: {
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
          balance?: number
          month?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_month_balances_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_month_balances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      account_openings: {
        Row: {
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          id: string
          updated_at: string
          amount: number
          as_on: string
          notes: string | null
        }
        Insert: {
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
          amount: number
          as_on: string
          notes?: string | null
        }
        Update: {
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
          amount?: number
          as_on?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_openings_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_openings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: number
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          row_id: string | null
          table_name: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          row_id?: string | null
          table_name: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          row_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          opening_balance: number
        }
        Insert: {
          account_number?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          opening_balance?: number
        }
        Update: {
          account_number?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          opening_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      bank_reconciliation_signoffs: {
        Row: {
          bank_account_id: string
          book_balance: number
          completed_at: string
          completed_by: string | null
          difference: number
          id: string
          note: string | null
          statement_balance: number
          statement_date: string
          uncleared_deposits: number
          uncleared_withdrawals: number
        }
        Insert: {
          bank_account_id: string
          book_balance: number
          completed_at?: string
          completed_by?: string | null
          difference?: number
          id?: string
          note?: string | null
          statement_balance: number
          statement_date: string
          uncleared_deposits?: number
          uncleared_withdrawals?: number
        }
        Update: {
          bank_account_id?: string
          book_balance?: number
          completed_at?: string
          completed_by?: string | null
          difference?: number
          id?: string
          note?: string | null
          statement_balance?: number
          statement_date?: string
          uncleared_deposits?: number
          uncleared_withdrawals?: number
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliation_signoffs_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          bank_account_id: string
          cleared_on: string
          created_at: string
          created_by: string | null
          id: string
          journal_line_id: string
        }
        Insert: {
          bank_account_id: string
          cleared_on: string
          created_at?: string
          created_by?: string | null
          id?: string
          journal_line_id: string
        }
        Update: {
          bank_account_id?: string
          cleared_on?: string
          created_at?: string
          created_by?: string | null
          id?: string
          journal_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_journal_line_id_fkey"
            columns: ["journal_line_id"]
            isOneToOne: true
            referencedRelation: "journal_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_transactions: {
        Row: {
          deleted_at: string | null
          deleted_by: string | null
          delete_reason: string | null
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          date: string | null
          display_id: string | null
          id: string
          notes: string | null
          partner_id: string
          payment_mode: string | null
          type: Database["public"]["Enums"]["capital_tx_type"]
        }
        Insert: {
          deleted_at?: string | null
          deleted_by?: string | null
          delete_reason?: string | null
          amount: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string | null
          display_id?: string | null
          id?: string
          notes?: string | null
          partner_id: string
          payment_mode?: string | null
          type: Database["public"]["Enums"]["capital_tx_type"]
        }
        Update: {
          deleted_at?: string | null
          deleted_by?: string | null
          delete_reason?: string | null
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string | null
          display_id?: string | null
          id?: string
          notes?: string | null
          partner_id?: string
          payment_mode?: string | null
          type?: Database["public"]["Enums"]["capital_tx_type"]
        }
        Relationships: [
          {
            foreignKeyName: "capital_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "capital_transactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_transactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      clients: {
        Row: {
          address_line1: string | null
          city: string | null
          client_code: string | null
          created_at: string
          created_by: string | null
          display_id: string | null
          email: string | null
          gst: string | null
          gst_on_proof: boolean
          id: string
          name: string
          pincode: string | null
          state: string | null
        }
        Insert: {
          address_line1?: string | null
          city?: string | null
          client_code?: string | null
          created_at?: string
          created_by?: string | null
          display_id?: string | null
          email?: string | null
          gst?: string | null
          gst_on_proof?: boolean
          id?: string
          name: string
          pincode?: string | null
          state?: string | null
        }
        Update: {
          address_line1?: string | null
          city?: string | null
          client_code?: string | null
          created_at?: string
          created_by?: string | null
          display_id?: string | null
          email?: string | null
          gst?: string | null
          gst_on_proof?: boolean
          id?: string
          name?: string
          pincode?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      company_profile: {
        Row: {
          address: string | null
          bank_details: string | null
          books_locked_until: string | null
          email: string | null
          gstin: string | null
          id: string
          name: string | null
          pan: string | null
          phone: string | null
          state_code: string | null
          udyam_no: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          bank_details?: string | null
          books_locked_until?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          name?: string | null
          pan?: string | null
          phone?: string | null
          state_code?: string | null
          udyam_no?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          bank_details?: string | null
          books_locked_until?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          name?: string | null
          pan?: string | null
          phone?: string | null
          state_code?: string | null
          udyam_no?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cost_centers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          sort_order: number
          tags: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          sort_order: number
          tags?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          sort_order?: number
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      expense_purposes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          sort_order: number
          tags: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          sort_order?: number
          tags?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          sort_order?: number
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "expense_purposes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_purposes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      expense_reimbursements: {
        Row: {
          deleted_at: string | null
          deleted_by: string | null
          delete_reason: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          date: string
          display_id: string | null
          expense_id: string | null
          id: string
          payment_mode: string | null
          reference: string | null
          vendor_bill_payment_id: string | null
        }
        Insert: {
          deleted_at?: string | null
          deleted_by?: string | null
          delete_reason?: string | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          display_id?: string | null
          expense_id?: string | null
          id?: string
          payment_mode?: string | null
          reference?: string | null
          vendor_bill_payment_id?: string | null
        }
        Update: {
          deleted_at?: string | null
          deleted_by?: string | null
          delete_reason?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          display_id?: string | null
          expense_id?: string | null
          id?: string
          payment_mode?: string | null
          reference?: string | null
          vendor_bill_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_reimbursements_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_reimbursements_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "expense_reimbursements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_reimbursements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_reimbursements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "expense_reimbursements_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_reimbursements_vendor_bill_payment_id_fkey"
            columns: ["vendor_bill_payment_id"]
            isOneToOne: false
            referencedRelation: "vendor_bill_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_sub_heads: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          major_head: string
          major_head_code: number
          name: string
          sort_order: number
          tags: string[]
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          major_head: string
          major_head_code: number
          name: string
          sort_order: number
          tags?: string[]
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          major_head?: string
          major_head_code?: number
          name?: string
          sort_order?: number
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "expense_sub_heads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_sub_heads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      expense_units: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_units_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_units_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      expenses: {
        Row: {
          deleted_at: string | null
          deleted_by: string | null
          delete_reason: string | null
          duplicate_reason: string | null
          on_behalf_of: string | null
          additional_amount: number | null
          amount: number
          bank_account_id: string | null
          cost_center: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string
          display_id: string | null
          geo_lat: number | null
          geo_lng: number | null
          gst_pct: number
          id: string
          paid_from_imprest: boolean
          payment_mode: string | null
          project_id: string | null
          purpose: string | null
          qty: number | null
          rate: number | null
          receipt_path: string | null
          reimbursable: boolean
          reimburse_to: string | null
          remarks: string | null
          status: string
          sub_head_id: string | null
          trip_id: string | null
          unit: string | null
          vendor_id: string | null
        }
        Insert: {
          deleted_at?: string | null
          deleted_by?: string | null
          delete_reason?: string | null
          duplicate_reason?: string | null
          on_behalf_of?: string | null
          additional_amount?: number | null
          amount: number
          bank_account_id?: string | null
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          description: string
          display_id?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          gst_pct?: number
          id?: string
          paid_from_imprest?: boolean
          payment_mode?: string | null
          project_id?: string | null
          purpose?: string | null
          qty?: number | null
          rate?: number | null
          receipt_path?: string | null
          reimbursable?: boolean
          reimburse_to?: string | null
          remarks?: string | null
          status?: string
          sub_head_id?: string | null
          trip_id?: string | null
          unit?: string | null
          vendor_id?: string | null
        }
        Update: {
          deleted_at?: string | null
          deleted_by?: string | null
          delete_reason?: string | null
          duplicate_reason?: string | null
          on_behalf_of?: string | null
          additional_amount?: number | null
          amount?: number
          bank_account_id?: string | null
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          display_id?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          gst_pct?: number
          id?: string
          paid_from_imprest?: boolean
          payment_mode?: string | null
          project_id?: string | null
          purpose?: string | null
          qty?: number | null
          rate?: number | null
          receipt_path?: string | null
          reimbursable?: boolean
          reimburse_to?: string | null
          remarks?: string | null
          status?: string
          sub_head_id?: string | null
          trip_id?: string | null
          unit?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "expenses_sub_head_id_fkey"
            columns: ["sub_head_id"]
            isOneToOne: false
            referencedRelation: "expense_sub_heads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_summary"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_accounts: {
        Row: {
          account_type: string
          code: string
          id: string
          name: string
          normal_balance: string
          sort_order: number
        }
        Insert: {
          account_type: string
          code: string
          id?: string
          name: string
          normal_balance: string
          sort_order: number
        }
        Update: {
          account_type?: string
          code?: string
          id?: string
          name?: string
          normal_balance?: string
          sort_order?: number
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      id_sequences: {
        Row: {
          counter: number
          prefix: string
        }
        Insert: {
          counter?: number
          prefix: string
        }
        Update: {
          counter?: number
          prefix?: string
        }
        Relationships: []
      }
      invoice_notes: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date: string
          display_id: string | null
          gst_amount: number
          gst_pct: number
          id: string
          invoice_id: string
          net_amount: number
          note_type: string
          reason: string
          retention_amount: number
          tds_amount: number
          tds_pct: number
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date: string
          display_id?: string | null
          gst_amount?: number
          gst_pct?: number
          id?: string
          invoice_id: string
          net_amount?: number
          note_type: string
          reason: string
          retention_amount?: number
          tds_amount?: number
          tds_pct?: number
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          display_id?: string | null
          gst_amount?: number
          gst_pct?: number
          id?: string
          invoice_id?: string
          net_amount?: number
          note_type?: string
          reason?: string
          retention_amount?: number
          tds_amount?: number
          tds_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "invoice_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_computed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_status"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          date: string
          display_id: string | null
          gst_component: number
          id: string
          invoice_id: string
          is_retention_release: boolean
          payment_mode: string | null
          receipt_id: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          display_id?: string | null
          gst_component?: number
          id?: string
          invoice_id: string
          is_retention_release?: boolean
          payment_mode?: string | null
          receipt_id?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          display_id?: string | null
          gst_component?: number
          id?: string
          invoice_id?: string
          is_retention_release?: boolean
          payment_mode?: string | null
          receipt_id?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_computed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_status"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          display_id: string | null
          due_date_manual: string | null
          due_days: number | null
          gst_on_hold: boolean
          gst_pct: number
          gstr3b_filed_on: string | null
          gstr3b_period: string | null
          gstr3b_sent_on: string | null
          hsn_sac: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          project_id: string | null
          retention_pct: number
          retention_release_date: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          tds_pct: number
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_id?: string | null
          due_date_manual?: string | null
          due_days?: number | null
          gst_on_hold?: boolean
          gst_pct?: number
          gstr3b_filed_on?: string | null
          gstr3b_period?: string | null
          gstr3b_sent_on?: string | null
          hsn_sac?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          project_id?: string | null
          retention_pct?: number
          retention_release_date?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          tds_pct?: number
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_id?: string | null
          due_date_manual?: string | null
          due_days?: number | null
          gst_on_hold?: boolean
          gst_pct?: number
          gstr3b_filed_on?: string | null
          gstr3b_period?: string | null
          gstr3b_sent_on?: string | null
          hsn_sac?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          project_id?: string | null
          retention_pct?: number
          retention_release_date?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          tds_pct?: number
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
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          date: string
          description: string
          display_id: string | null
          id: string
          source_id: string
          source_table: string
        }
        Insert: {
          created_at?: string
          date: string
          description: string
          display_id?: string | null
          id?: string
          source_id: string
          source_table: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string
          display_id?: string | null
          id?: string
          source_id?: string
          source_table?: string
        }
        Relationships: []
      }
      journal_lines: {
        Row: {
          bank_account_id: string | null
          client_id: string | null
          cost_center: string | null
          credit: number
          debit: number
          entry_id: string
          gl_account_id: string
          id: string
          loan_id: string | null
          partner_id: string | null
          profile_id: string | null
          project_id: string | null
          staff_id: string | null
          sub_head_id: string | null
          trip_id: string | null
          vendor_id: string | null
        }
        Insert: {
          bank_account_id?: string | null
          client_id?: string | null
          cost_center?: string | null
          credit?: number
          debit?: number
          entry_id: string
          gl_account_id: string
          id?: string
          loan_id?: string | null
          partner_id?: string | null
          profile_id?: string | null
          project_id?: string | null
          staff_id?: string | null
          sub_head_id?: string | null
          trip_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          bank_account_id?: string | null
          client_id?: string | null
          cost_center?: string | null
          credit?: number
          debit?: number
          entry_id?: string
          gl_account_id?: string
          id?: string
          loan_id?: string | null
          partner_id?: string | null
          profile_id?: string | null
          project_id?: string | null
          staff_id?: string | null
          sub_head_id?: string | null
          trip_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "v_loan_computed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "journal_lines_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "journal_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "journal_lines_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_sub_head_id_fkey"
            columns: ["sub_head_id"]
            isOneToOne: false
            referencedRelation: "expense_sub_heads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "journal_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_summary"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "journal_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_payments: {
        Row: {
          deleted_at: string | null
          deleted_by: string | null
          delete_reason: string | null
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          date: string
          display_id: string | null
          id: string
          interest_paid: number
          loan_id: string
          payment_mode: string | null
          principal_paid: number
          reference: string | null
        }
        Insert: {
          deleted_at?: string | null
          deleted_by?: string | null
          delete_reason?: string | null
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          display_id?: string | null
          id?: string
          interest_paid?: number
          loan_id: string
          payment_mode?: string | null
          principal_paid?: number
          reference?: string | null
        }
        Update: {
          deleted_at?: string | null
          deleted_by?: string | null
          delete_reason?: string | null
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          display_id?: string | null
          id?: string
          interest_paid?: number
          loan_id?: string
          payment_mode?: string | null
          principal_paid?: number
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "v_loan_computed"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          deleted_at: string | null
          deleted_by: string | null
          delete_reason: string | null
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          date_taken: string | null
          display_id: string | null
          id: string
          lender: string
          loan_type: string
          notes: string | null
          payment_mode: string | null
          principal: number
          roi_pct: number
        }
        Insert: {
          deleted_at?: string | null
          deleted_by?: string | null
          delete_reason?: string | null
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date_taken?: string | null
          display_id?: string | null
          id?: string
          lender: string
          loan_type?: string
          notes?: string | null
          payment_mode?: string | null
          principal: number
          roi_pct: number
        }
        Update: {
          deleted_at?: string | null
          deleted_by?: string | null
          delete_reason?: string | null
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date_taken?: string | null
          display_id?: string | null
          id?: string
          lender?: string
          loan_type?: string
          notes?: string | null
          payment_mode?: string | null
          principal?: number
          roi_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "loans_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget: number | null
          client_id: string
          code: string | null
          cost_center: string | null
          created_at: string
          created_by: string | null
          display_id: string | null
          end_date: string | null
          id: string
          name: string
          project_location: string | null
          same_as_client_address: boolean
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          value_ex_gst: number | null
        }
        Insert: {
          budget?: number | null
          client_id: string
          code?: string | null
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          display_id?: string | null
          end_date?: string | null
          id?: string
          name: string
          project_location?: string | null
          same_as_client_address?: boolean
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          value_ex_gst?: number | null
        }
        Update: {
          budget?: number | null
          client_id?: string
          code?: string | null
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          display_id?: string | null
          end_date?: string | null
          id?: string
          name?: string
          project_location?: string | null
          same_as_client_address?: boolean
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          value_ex_gst?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          created_by: string | null
          daily_rate: number
          default_project_id: string | null
          display_id: string | null
          end_date: string | null
          id: string
          name: string
          phone: string | null
          start_date: string
          supervisor_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          daily_rate?: number
          default_project_id?: string | null
          display_id?: string | null
          end_date?: string | null
          id?: string
          name: string
          phone?: string | null
          start_date?: string
          supervisor_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          daily_rate?: number
          default_project_id?: string | null
          display_id?: string | null
          end_date?: string | null
          id?: string
          name?: string
          phone?: string | null
          start_date?: string
          supervisor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_default_project_id_fkey"
            columns: ["default_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_default_project_id_fkey"
            columns: ["default_project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "staff_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      staff_attendance: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          day_type: string
          id: string
          staff_id: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          day_type?: string
          id?: string
          staff_id: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          day_type?: string
          id?: string
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "staff_attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_imprest_transactions: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          date: string
          display_id: string | null
          id: string
          kind: string
          profile_id: string
          reimbursable: boolean
          remarks: string | null
          staff_id: string | null
          status: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          display_id?: string | null
          id?: string
          kind: string
          profile_id: string
          reimbursable?: boolean
          remarks?: string | null
          staff_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          display_id?: string | null
          id?: string
          kind?: string
          profile_id?: string
          reimbursable?: boolean
          remarks?: string | null
          staff_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_imprest_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_imprest_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_imprest_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "staff_imprest_transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_imprest_transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "staff_imprest_transactions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_location_pings: {
        Row: {
          created_at: string
          id: string
          lat: number
          lon: number
          profile_id: string
          taken_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lon: number
          profile_id: string
          taken_at: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lon?: number
          profile_id?: string
          taken_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_location_pings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_location_pings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      staff_project_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          project_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          project_id: string
          staff_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          project_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_project_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_project_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "staff_project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "staff_project_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_salary_advances: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          date: string
          display_id: string | null
          id: string
          remarks: string | null
          source_id: string | null
          source_table: string | null
          staff_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          display_id?: string | null
          id?: string
          remarks?: string | null
          source_id?: string | null
          source_table?: string | null
          staff_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          display_id?: string | null
          id?: string
          remarks?: string | null
          source_id?: string | null
          source_table?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_salary_advances_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_salary_advances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_salary_advances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "staff_salary_advances_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_projects: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_projects_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_projects_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "supervisor_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
        ]
      }
      transfers: {
        Row: {
          deleted_at: string | null
          deleted_by: string | null
          delete_reason: string | null
          amount: number
          created_at: string
          created_by: string | null
          date: string
          display_id: string | null
          from_account_id: string | null
          id: string
          notes: string | null
          to_account_id: string | null
        }
        Insert: {
          deleted_at?: string | null
          deleted_by?: string | null
          delete_reason?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          date: string
          display_id?: string | null
          from_account_id?: string | null
          id?: string
          notes?: string | null
          to_account_id?: string | null
        }
        Update: {
          deleted_at?: string | null
          deleted_by?: string | null
          delete_reason?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          display_id?: string | null
          from_account_id?: string | null
          id?: string
          notes?: string | null
          to_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          cost_center: string | null
          created_at: string
          created_by: string | null
          display_id: string | null
          end_date: string | null
          id: string
          name: string
          notes: string | null
          project_id: string | null
          start_date: string
          status: string
          traveler_id: string
        }
        Insert: {
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          display_id?: string | null
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          project_id?: string | null
          start_date: string
          status?: string
          traveler_id: string
        }
        Update: {
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          display_id?: string | null
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          project_id?: string | null
          start_date?: string
          status?: string
          traveler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "trips_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "trips_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      vendor_advances: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          date: string
          display_id: string | null
          id: string
          notes: string | null
          payment_mode: string
          reference: string | null
          vendor_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          display_id?: string | null
          id?: string
          notes?: string | null
          payment_mode?: string
          reference?: string | null
          vendor_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          display_id?: string | null
          id?: string
          notes?: string | null
          payment_mode?: string
          reference?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_advances_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_advances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_advances_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_bill_items: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          id: string
          name: string
          position: number
          qty: number | null
          rate: number | null
          unit: string | null
        }
        Insert: {
          amount: number
          bill_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
          qty?: number | null
          rate?: number | null
          unit?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          qty?: number | null
          rate?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "vendor_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_bill_payments: {
        Row: {
          advance_id: string | null
          amount: number
          bank_account_id: string | null
          bill_id: string
          created_at: string
          created_by: string | null
          date: string
          display_id: string | null
          id: string
          paid_by: string | null
          payment_mode: string | null
          reference: string | null
        }
        Insert: {
          advance_id?: string | null
          amount: number
          bank_account_id?: string | null
          bill_id: string
          created_at?: string
          created_by?: string | null
          date: string
          display_id?: string | null
          id?: string
          paid_by?: string | null
          payment_mode?: string | null
          reference?: string | null
        }
        Update: {
          advance_id?: string | null
          amount?: number
          bank_account_id?: string | null
          bill_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          display_id?: string | null
          id?: string
          paid_by?: string | null
          payment_mode?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_bill_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bill_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_bill_computed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bill_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "vendor_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bill_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bill_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "vendor_bill_payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bill_payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      vendor_bills: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          created_by: string | null
          date: string | null
          description: string | null
          display_id: string | null
          gst_pct: number
          id: string
          other_cost: number | null
          project_id: string | null
          qty: number | null
          rate: number | null
          receipt_path: string | null
          remarks: string | null
          sub_head_id: string | null
          tds_pct: number
          tds_section: string | null
          vendor_id: string
          vendor_invoice_date: string | null
          vendor_invoice_no: string | null
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string | null
          description?: string | null
          display_id?: string | null
          gst_pct?: number
          id?: string
          other_cost?: number | null
          project_id?: string | null
          qty?: number | null
          rate?: number | null
          receipt_path?: string | null
          remarks?: string | null
          sub_head_id?: string | null
          tds_pct?: number
          tds_section?: string | null
          vendor_id: string
          vendor_invoice_date?: string | null
          vendor_invoice_no?: string | null
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string | null
          description?: string | null
          display_id?: string | null
          gst_pct?: number
          id?: string
          other_cost?: number | null
          project_id?: string | null
          qty?: number | null
          rate?: number | null
          receipt_path?: string | null
          remarks?: string | null
          sub_head_id?: string | null
          tds_pct?: number
          tds_section?: string | null
          vendor_id?: string
          vendor_invoice_date?: string | null
          vendor_invoice_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_bills_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bills_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "vendor_bills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "vendor_bills_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bills_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_bills_sub_head_id_fkey"
            columns: ["sub_head_id"]
            isOneToOne: false
            referencedRelation: "expense_sub_heads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_summary"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          category: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          display_id: string | null
          gstin: string | null
          gstpan: string | null
          id: string
          is_one_time: boolean
          name: string
          pan: string | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          display_id?: string | null
          gstin?: string | null
          gstpan?: string | null
          id?: string
          is_one_time?: boolean
          name: string
          pan?: string | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          display_id?: string | null
          gstin?: string | null
          gstpan?: string | null
          id?: string
          is_one_time?: boolean
          name?: string
          pan?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      wage_accruals: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          display_id: string | null
          id: string
          notes: string | null
          period_end: string
          period_start: string
          staff_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          display_id?: string | null
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          staff_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          display_id?: string | null
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wage_accruals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wage_accruals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "wage_accruals_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      wage_payments: {
        Row: {
          advance_recovered: number
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          date: string
          display_id: string | null
          id: string
          notes: string | null
          staff_id: string
        }
        Insert: {
          advance_recovered?: number
          amount: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          display_id?: string | null
          id?: string
          notes?: string | null
          staff_id: string
        }
        Update: {
          advance_recovered?: number
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          display_id?: string | null
          id?: string
          notes?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wage_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wage_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wage_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "wage_payments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_capital_summary: {
        Row: {
          name: string | null
          net: number | null
          partner_id: string | null
          total_injected: number | null
          total_withdrawn: number | null
        }
        Relationships: []
      }
      v_client_summary: {
        Row: {
          client_id: string | null
          due: number | null
          name: string | null
          received: number | null
          total_invoiced: number | null
        }
        Relationships: []
      }
      v_cost_center_summary: {
        Row: {
          account_name: string | null
          code: string | null
          cost_center: string | null
          total_credit: number | null
          total_debit: number | null
        }
        Relationships: []
      }
      v_dashboard_kpis: {
        Row: {
          active_projects: number | null
          cash_and_bank_balance: number | null
          clients_count: number | null
          expenses_this_month: number | null
          gst_held_by_clients: number | null
          loan_principal_outstanding: number | null
          net_partner_capital: number | null
          outstanding_from_clients: number | null
          overdue_invoices_amount: number | null
          overdue_invoices_count: number | null
          owed_to_vendors: number | null
        }
        Relationships: []
      }
      v_invoice_computed: {
        Row: {
          amount: number | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          display_id: string | null
          due_date_manual: string | null
          due_days: number | null
          effective_due_date: string | null
          gst_amt: number | null
          gst_held: number | null
          gst_on_hold: boolean | null
          gst_pct: number | null
          gst_released: number | null
          id: string | null
          invoice_date: string | null
          net_payable: number | null
          note_amount: number | null
          project_id: string | null
          released_paid: number | null
          retention_amount: number | null
          retention_pct: number | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          tds_amt: number | null
          tds_pct: number | null
          total_paid: number | null
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
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
        ]
      }
      v_invoice_status: {
        Row: {
          amount: number | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          display_id: string | null
          due_amount: number | null
          due_date_manual: string | null
          due_days: number | null
          effective_due_date: string | null
          effective_status: string | null
          gst_amt: number | null
          gst_pct: number | null
          id: string | null
          invoice_date: string | null
          net_payable: number | null
          project_id: string | null
          retention_amount: number | null
          retention_pct: number | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          tds_amt: number | null
          tds_pct: number | null
          total_paid: number | null
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
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
        ]
      }
      v_loan_computed: {
        Row: {
          created_at: string | null
          created_by: string | null
          date_taken: string | null
          display_id: string | null
          id: string | null
          interest_paid: number | null
          lender: string | null
          notes: string | null
          outstanding: number | null
          principal: number | null
          principal_paid: number | null
          roi_pct: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date_taken?: string | null
          display_id?: string | null
          id?: string | null
          interest_paid?: never
          lender?: string | null
          notes?: string | null
          outstanding?: never
          principal?: number | null
          principal_paid?: never
          roi_pct?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date_taken?: string | null
          display_id?: string | null
          id?: string | null
          interest_paid?: never
          lender?: string | null
          notes?: string | null
          outstanding?: never
          principal?: number | null
          principal_paid?: never
          roi_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      v_project_summary: {
        Row: {
          client_name: string | null
          due: number | null
          name: string | null
          project_id: string | null
          received: number | null
          total_invoiced: number | null
        }
        Relationships: []
      }
      v_trial_balance: {
        Row: {
          account_type: string | null
          balance: number | null
          code: string | null
          name: string | null
          normal_balance: string | null
          total_credit: number | null
          total_debit: number | null
        }
        Relationships: []
      }
      v_trip_summary: {
        Row: {
          display_id: string | null
          end_date: string | null
          entry_count: number | null
          name: string | null
          start_date: string | null
          status: string | null
          total_spent: number | null
          traveler_id: string | null
          trip_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      v_vendor_bill_computed: {
        Row: {
          amount: number | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          date: string | null
          description: string | null
          display_id: string | null
          gst_amt: number | null
          gst_pct: number | null
          id: string | null
          other_cost: number | null
          paid: number | null
          payable: number | null
          project_id: string | null
          tds_amt: number | null
          tds_pct: number | null
          total: number | null
          vendor_id: string | null
        }
        Insert: {
          amount?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          description?: string | null
          display_id?: string | null
          gst_amt?: never
          gst_pct?: number | null
          id?: string | null
          other_cost?: never
          paid?: never
          payable?: never
          project_id?: string | null
          tds_amt?: never
          tds_pct?: number | null
          total?: never
          vendor_id?: string | null
        }
        Update: {
          amount?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          description?: string | null
          display_id?: string | null
          gst_amt?: never
          gst_pct?: number | null
          id?: string | null
          other_cost?: never
          paid?: never
          payable?: never
          project_id?: string | null
          tds_amt?: never
          tds_pct?: number | null
          total?: never
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_bills_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bills_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "vendor_bills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_capital_summary"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "vendor_bills_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bills_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_summary"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v_vendor_summary: {
        Row: {
          due: number | null
          name: string | null
          total_paid: number | null
          total_purchases: number | null
          vendor_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activity_by_user: {
        Args: { p_user: string; p_from?: string; p_to?: string; p_by_recorded?: boolean }
        Returns: {
          activity_date: string
          recorded_at: string
          kind: string
          source_table: string
          source_id: string
          display_id: string | null
          description: string | null
          amount: number | null
          direction: string | null
          status: string | null
          reimbursable: boolean
        }[]
      }
      books_health_check: {
        Args: never
        Returns: {
          amount: number
          check_code: string
          detail: string
          severity: string
          title: string
        }[]
      }
      books_locked: { Args: { p_date: string }; Returns: boolean }
      trash_record: { Args: { p_table: string; p_id: string; p_reason?: string | null }; Returns: undefined }
      restore_record: { Args: { p_table: string; p_id: string }; Returns: undefined }
      list_trash: { Args: never; Returns: Record<string, unknown>[] }
      cash_or_bank: { Args: { p_bank_account_id: string }; Returns: string }
      client_state_code: { Args: { p_client: string }; Returns: string }
      company_state_code: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      delete_journal_voucher: { Args: { p_entry: string }; Returns: undefined }
      expense_gl_account: { Args: { p_sub_head_id: string }; Returns: string }
      gl_acct: { Args: { p_code: string }; Returns: string }
      gl_balances: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          account_type: string
          code: string
          name: string
          normal_balance: string
          sort_order: number
          total_credit: number
          total_debit: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_back_office: { Args: never; Returns: boolean }
      next_display_id: { Args: { p_prefix: string }; Returns: string }
      post_gst_lines: {
        Args: {
          p_client: string
          p_credit: boolean
          p_entry: string
          p_gst: number
        }
        Returns: undefined
      }
      post_journal_voucher: {
        Args: { p_date: string; p_lines: Json; p_narration: string }
        Returns: string
      }
      report_summary: {
        Args: { p_from?: string; p_to?: string }
        Returns: Json
      }
      repost_all_invoices: { Args: never; Returns: Json }
      repost_invoice_advance: {
        Args: { p_invoice_id: string; p_skip_locked?: boolean }
        Returns: undefined
      }
      repost_invoice_entry: {
        Args: { p_invoice_id: string; p_skip_locked?: boolean }
        Returns: undefined
      }
      repost_invoice_note: {
        Args: { p_id: string; p_skip_locked?: boolean }
        Returns: undefined
      }
      repost_invoice_payment: {
        Args: { p_id: string; p_skip_locked?: boolean }
        Returns: undefined
      }
      vendor_state_code: { Args: { p_vendor: string }; Returns: string }
    }
    Enums: {
      attendance_status: "absent" | "half" | "leave" | "holiday" | "weeklyoff"
      capital_tx_type: "injection" | "withdrawal"
      invoice_status: "draft" | "sent"
      project_status: "active" | "completed"
      user_role: "admin" | "cxo" | "staff" | "supervisor"
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
      attendance_status: ["absent", "half", "leave", "holiday", "weeklyoff"],
      capital_tx_type: ["injection", "withdrawal"],
      invoice_status: ["draft", "sent"],
      project_status: ["active", "completed"],
      user_role: ["admin", "cxo", "staff", "supervisor"],
    },
  },
} as const
