import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { DateRange } from '../calc/reportPeriod'

export interface ReportSummary {
  output_gst: number
  input_gst: number
  tds_deducted: number
  total_invoiced: number
  total_received: number
  total_expenses: number
  vendor_purchases: number
  vendor_paid: number
  loan_interest_paid: number
  loan_principal_paid: number
  loan_outstanding_total: number
  capital_injected: number
  capital_withdrawn: number
}

/** Wraps the report_summary(p_from, p_to) RPC — a single server-side
 * aggregate covering GST, invoicing, expenses, vendor purchases, loans and
 * capital for an arbitrary date range (null bound = unbounded). */
export function useReportSummary(range: DateRange | null) {
  return useQuery({
    queryKey: ['report_summary', range],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_summary', {
        p_from: range?.from ?? undefined,
        p_to: range?.to ?? undefined,
      })
      if (error) throw error
      return data as unknown as ReportSummary
    },
  })
}
