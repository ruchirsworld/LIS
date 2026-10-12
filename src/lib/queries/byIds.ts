import { supabase } from '../supabase'
import type { Database } from '../../types/database'

type TableName = keyof Database['public']['Tables']

// A long `.in('id', [...])` list goes into the request URL, and past a few
// hundred UUIDs the URL is too long and the request fails. Reading in chunks
// keeps every request small however many ids there are.
const CHUNK = 100

/** Rows of `table` whose `column` is one of `ids`, fetched in small batches. */
export async function selectByIds<Row>(table: TableName, columns: string, column: string, ids: string[]): Promise<Row[]> {
  const unique = [...new Set(ids)]
  const rows: Row[] = []
  for (let i = 0; i < unique.length; i += CHUNK) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .in(column, unique.slice(i, i + CHUNK))
    if (error) throw error
    rows.push(...((data ?? []) as unknown as Row[]))
  }
  return rows
}
