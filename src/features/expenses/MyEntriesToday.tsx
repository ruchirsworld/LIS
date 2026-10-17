import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { fmt } from '../../lib/calc/format'

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
        .select('id, display_id, description, amount, date, created_at')
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
      {data.map((e) => (
        <div key={e.id} className="my-entries-row">
          <span className="mono my-entries-id">{e.display_id}</span>
          <span className="my-entries-desc">{e.description}</span>
          <span className="my-entries-amt">{fmt(e.amount)}</span>
        </div>
      ))}
    </div>
  )
}
