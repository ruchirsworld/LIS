import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { fmt, fmtDate } from '../../lib/calc/format'
import { CostCentreTag, costCentreKind } from '../../components/ui'

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/** A small list under an entry form: what this person has recorded today, newest first, so a repeat or a miss is easy to spot. */
export function MyEntriesToday() {
  const { profile } = useAuth()
  const { data } = useQuery({
    queryKey: ['expenses', 'my-today', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, display_id, description, remarks, cost_center, amount, date, created_at')
        .eq('created_by', profile!.id)
        .gte('created_at', startOfTodayIso())
        .order('created_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return data
    },
  })
  if (!data || data.length === 0) return null
  return (
    <div className="my-entries-today">
      <div className="my-entries-title">My entries today</div>
      {data.map((e) => {
        const cc = costCentreKind(e.cost_center)
        return (
        <div key={e.id} className="my-entries-row">
          <span className="mono my-entries-id">{e.display_id}</span>
          <span className="my-entries-date" title="The date of the entry">{fmtDate(e.date)}</span>
          <span className="my-entries-cc">{cc ? <CostCentreTag kind={cc} /> : null}</span>
          <span className="my-entries-desc">{e.description}</span>
          <span className="my-entries-remarks" title={e.remarks ?? undefined}>{e.remarks}</span>
          <span className="my-entries-amt">{fmt(e.amount)}</span>
        </div>
        )
      })}
    </div>
  )
}
