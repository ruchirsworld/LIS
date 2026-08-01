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
        ]
      }
      capital_transactions: {
        Row: {
          amount: number
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
          amount: number
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
          amount?: number
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
            foreignKeyName: "capital_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
        ]
      }
      cost_centers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          sort_order: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          tags: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          tags?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          cost_center: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string
          display_id: string | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          payment_mode: string | null
          project_id: string | null
          receipt_path: string | null
          reimbursable: boolean
          reimbursed: boolean
          remarks: string | null
          type: string
          vendor_id: string | null
        }
        Insert: {
          amount: number
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          description: string
          display_id?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          payment_mode?: string | null
          project_id?: string | null
          receipt_path?: string | null
          reimbursable?: boolean
          reimbursed?: boolean
          remarks?: string | null
          type: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          display_id?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          payment_mode?: string | null
          project_id?: string | null
          receipt_path?: string | null
          reimbursable?: boolean
          reimbursed?: boolean
          remarks?: string | null
          type?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date: string
          display_id: string | null
          id: string
          invoice_id: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date: string
          display_id?: string | null
          id?: string
          invoice_id: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          display_id?: string | null
          id?: string
          invoice_id?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
          display_id: string | null
          due_date_manual: string | null
          due_days: number | null
          gst_pct: number
          id: string
          invoice_date: string | null
          invoice_number: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          tds_pct: number
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          created_by?: string | null
          display_id?: string | null
          due_date_manual?: string | null
          due_days?: number | null
          gst_pct?: number
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          tds_pct?: number
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          display_id?: string | null
          due_date_manual?: string | null
          due_days?: number | null
          gst_pct?: number
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          project_id?: string | null
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
      loan_payments: {
        Row: {
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
            foreignKeyName: "loan_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
          created_at: string
          created_by: string | null
          date_taken: string | null
          display_id: string | null
          id: string
          lender: string
          loan_type: string
          notes: string | null
          principal: number
          roi_pct: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_taken?: string | null
          display_id?: string | null
          id?: string
          lender: string
          loan_type?: string
          notes?: string | null
          principal: number
          roi_pct: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_taken?: string | null
          display_id?: string | null
          id?: string
          lender?: string
          loan_type?: string
          notes?: string | null
          principal?: number
          roi_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "loans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
        ]
      }
      transfers: {
        Row: {
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
      vendor_bill_payments: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          created_by: string | null
          date: string
          display_id: string | null
          id: string
          payment_mode: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          bill_id: string
          created_at?: string
          created_by?: string | null
          date: string
          display_id?: string | null
          id?: string
          payment_mode?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          display_id?: string | null
          id?: string
          payment_mode?: string | null
          reference?: string | null
        }
        Relationships: [
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
          project_id: string | null
          qty: number | null
          rate: number | null
          receipt_path: string | null
          remarks: string | null
          vendor_id: string
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
          project_id?: string | null
          qty?: number | null
          rate?: number | null
          receipt_path?: string | null
          remarks?: string | null
          vendor_id: string
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
          project_id?: string | null
          qty?: number | null
          rate?: number | null
          receipt_path?: string | null
          remarks?: string | null
          vendor_id?: string
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
      vendors: {
        Row: {
          address: string | null
          category: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          display_id: string | null
          gstpan: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          display_id?: string | null
          gstpan?: string | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          display_id?: string | null
          gstpan?: string | null
          id?: string
          name?: string
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
      v_dashboard_kpis: {
        Row: {
          active_projects: number | null
          clients_count: number | null
          expenses_this_month: number | null
          loan_principal_outstanding: number | null
          net_partner_capital: number | null
          outstanding_from_clients: number | null
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
          gst_pct: number | null
          id: string | null
          invoice_date: string | null
          net_payable: number | null
          project_id: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          tds_amt: number | null
          tds_pct: number | null
          total_paid: number | null
        }
        Insert: {
          amount?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          display_id?: string | null
          due_date_manual?: string | null
          due_days?: number | null
          effective_due_date?: never
          gst_amt?: never
          gst_pct?: number | null
          id?: string | null
          invoice_date?: string | null
          net_payable?: never
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          tds_amt?: never
          tds_pct?: number | null
          total_paid?: never
        }
        Update: {
          amount?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          display_id?: string | null
          due_date_manual?: string | null
          due_days?: number | null
          effective_due_date?: never
          gst_amt?: never
          gst_pct?: number | null
          id?: string | null
          invoice_date?: string | null
          net_payable?: never
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          tds_amt?: never
          tds_pct?: number | null
          total_paid?: never
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
          status: Database["public"]["Enums"]["invoice_status"] | null
          tds_amt: number | null
          tds_pct: number | null
          total_paid: number | null
        }
        Insert: {
          amount?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          display_id?: string | null
          due_amount?: never
          due_date_manual?: string | null
          due_days?: number | null
          effective_due_date?: never
          effective_status?: never
          gst_amt?: never
          gst_pct?: number | null
          id?: string | null
          invoice_date?: string | null
          net_payable?: never
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          tds_amt?: never
          tds_pct?: number | null
          total_paid?: never
        }
        Update: {
          amount?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          display_id?: string | null
          due_amount?: never
          due_date_manual?: string | null
          due_days?: number | null
          effective_due_date?: never
          effective_status?: never
          gst_amt?: never
          gst_pct?: number | null
          id?: string | null
          invoice_date?: string | null
          net_payable?: never
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          tds_amt?: never
          tds_pct?: number | null
          total_paid?: never
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
          paid: number | null
          project_id: string | null
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
          paid?: never
          project_id?: string | null
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
          paid?: never
          project_id?: string | null
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
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      next_display_id: { Args: { p_prefix: string }; Returns: string }
      report_summary: {
        Args: { p_from?: string; p_to?: string }
        Returns: Json
      }
    }
    Enums: {
      attendance_status: "absent" | "half" | "leave" | "holiday" | "weeklyoff"
      capital_tx_type: "injection" | "withdrawal"
      invoice_status: "draft" | "sent"
      project_status: "active" | "completed"
      user_role: "admin" | "cxo" | "staff"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      user_role: ["admin", "cxo", "staff"],
    },
  },
} as const
