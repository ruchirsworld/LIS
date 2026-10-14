import { describe, expect, it } from 'vitest'
import { getErrorMessage } from './errors'

describe('getErrorMessage', () => {
  it('explains a delete blocked by linked records in plain words', () => {
    const err = new Error('update or delete on table "trips" violates foreign key constraint "expenses_trip_id_fkey" on table "expenses"')
    expect(getErrorMessage(err, 'x')).toBe('This cannot be deleted because expenses are still linked to it. Remove or move those first.')
  })
  it('explains a permission block', () => {
    expect(getErrorMessage({ message: 'new row violates row-level security policy for table "invoices"' }, 'x')).toBe('You do not have permission to do that.')
  })
  it('leaves other messages alone and falls back when there is none', () => {
    expect(getErrorMessage(new Error('Invoice number A is already used by another invoice.'), 'x')).toBe('Invoice number A is already used by another invoice.')
    expect(getErrorMessage(undefined, 'Could not save.')).toBe('Could not save.')
  })
})
