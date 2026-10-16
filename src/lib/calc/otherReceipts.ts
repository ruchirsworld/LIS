// Money received that is not a client payment, a loan, partner capital or a transfer between our own accounts.

export type OtherReceiptKind = 'security_deposit' | 'refund' | 'interest' | 'sale' | 'other'

export const OTHER_RECEIPT_KINDS: { value: OtherReceiptKind; label: string; hint: string }[] = [
  { value: 'security_deposit', label: 'Security deposit given back', hint: 'A deposit we paid earlier (for an office, a site or a connection) and have now got back.' },
  { value: 'refund', label: 'Refund or money returned by someone', hint: 'A vendor or other party returning money for something we paid for.' },
  { value: 'interest', label: 'Interest received', hint: 'Interest the bank or anyone else paid us.' },
  { value: 'sale', label: 'Sale of scrap or an old item', hint: 'Money from selling scrap, old equipment or anything we no longer use.' },
  { value: 'other', label: 'Other income', hint: 'Any other money received that is not a client payment, a loan or capital.' },
]

export const otherReceiptLabel = (kind: string) => OTHER_RECEIPT_KINDS.find((k) => k.value === kind)?.label ?? kind

/** The books account an entry of this kind is credited to: deposits come back from the asset they sit in,
 * everything else is income. */
export function otherReceiptAccount(kind: string): { code: string; name: string } {
  return kind === 'security_deposit' ? { code: '1080', name: 'Security Deposits' } : { code: '4020', name: 'Other Income' }
}
