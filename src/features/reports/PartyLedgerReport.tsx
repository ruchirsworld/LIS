import { useState } from 'react'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useClients, useVendors, useStaff } from '../../lib/queries/masters'
import { useLoans } from '../../lib/queries/loans'
import { useProfiles } from '../../lib/queries/admin'
import { useLedgerLines } from '../../lib/queries/ledger'
import { clientLabel, clientFullName, clientGstLine } from '../../lib/labels'
import { fmt, fmtDate } from '../../lib/calc/format'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

type PartyType = 'client' | 'vendor' | 'loan' | 'partner' | 'imprest' | 'salary_advance'

const PARTY_CONFIG: Record<
  PartyType,
  {
    glAccountCode: string
    partyColumn: 'client_id' | 'vendor_id' | 'loan_id' | 'partner_id' | 'profile_id' | 'staff_id'
    balanceSign: 1 | -1
    balanceLabel: string
    pickerLabel: string
  }
> = {
  // Accounts Receivable is debit-normal — a positive running balance here is
  // straightforwardly what the client still owes, no sign flip needed.
  client: { glAccountCode: '1030', partyColumn: 'client_id', balanceSign: 1, balanceLabel: 'Amount due', pickerLabel: 'Client' },
  // Accounts Payable / Loans Payable / Partner Capital are all credit-normal
  // — flipping the sign makes the running balance read as "what we owe them"
  // (or "net capital in", for partners) as a positive number, not negative.
  vendor: { glAccountCode: '2010', partyColumn: 'vendor_id', balanceSign: -1, balanceLabel: 'Amount due', pickerLabel: 'Vendor' },
  loan: { glAccountCode: '2040', partyColumn: 'loan_id', balanceSign: -1, balanceLabel: 'Outstanding', pickerLabel: 'Lender' },
  partner: { glAccountCode: '3010', partyColumn: 'partner_id', balanceSign: -1, balanceLabel: 'Net capital', pickerLabel: 'Partner' },
  // Site Imprest and Salary Advance are both debit-normal assets — same
  // no-flip logic as Accounts Receivable: a positive balance is straightforwardly
  // what's still outstanding (float held / advance not yet recovered).
  imprest: { glAccountCode: '1060', partyColumn: 'profile_id', balanceSign: 1, balanceLabel: 'Float held', pickerLabel: 'Supervisor' },
  salary_advance: { glAccountCode: '1070', partyColumn: 'staff_id', balanceSign: 1, balanceLabel: 'Advance outstanding', pickerLabel: 'Staff' },
}

export function ClientLedgerReport() {
  return <PartyLedgerReport partyType="client" />
}
export function VendorLedgerReport() {
  return <PartyLedgerReport partyType="vendor" />
}
export function LoanLedgerReport() {
  return <PartyLedgerReport partyType="loan" />
}
export function PartnerLedgerReport() {
  return <PartyLedgerReport partyType="partner" />
}
export function SiteImprestLedgerReport() {
  return <PartyLedgerReport partyType="imprest" />
}
export function SalaryAdvanceLedgerReport() {
  return <PartyLedgerReport partyType="salary_advance" />
}

function PartyLedgerReport({ partyType }: { partyType: PartyType }) {
  const config = PARTY_CONFIG[partyType]
  const [partyId, setPartyId] = useState('')

  const { data: clients } = useClients()
  const { data: vendors } = useVendors()
  const { data: loans } = useLoans(null)
  const { data: profiles } = useProfiles()
  const { data: staff } = useStaff()

  // `label` is what the app's own picker shows (just the client code, per
  // clientLabel()); `fullName` is what a downloaded PDF/Excel export shows
  // instead — only Client actually has a separate code, so every other
  // party type's fullName is just its own label.
  const parties =
    partyType === 'client'
      ? (clients ?? []).map((c) => ({ id: c.id, label: clientLabel(c), fullName: clientFullName(c), gst: clientGstLine(c) }))
      : partyType === 'vendor'
        ? (vendors ?? []).map((v) => ({ id: v.id, label: v.name, fullName: v.name, gst: null as string | null }))
        : partyType === 'loan'
          ? (loans ?? []).map((l) => ({
              id: l.id,
              label: `${l.display_id ?? ''} — ${l.lender}`,
              fullName: `${l.display_id ?? ''} — ${l.lender}`,
              gst: null as string | null,
            }))
          : partyType === 'partner'
            ? (profiles ?? []).map((p) => ({ id: p.id, label: p.name, fullName: p.name, gst: null as string | null }))
            : partyType === 'imprest'
              ? (profiles ?? [])
                  .filter((p) => p.role === 'supervisor')
                  .map((p) => ({ id: p.id, label: p.name, fullName: p.name, gst: null as string | null }))
              : (staff ?? []).map((s) => ({ id: s.id, label: s.name, fullName: s.name, gst: null as string | null }))

  const { data: lines, isLoading } = useLedgerLines(config.glAccountCode, config.partyColumn, partyId || null)

  let running = 0
  const rows = (lines ?? []).map((l) => {
    running += config.balanceSign * (l.debit - l.credit)
    return { ...l, balance: running }
  })

  const selectedParty = parties.find((p) => p.id === partyId)

  const sections: ExportSection[] = selectedParty
    ? [
        {
          title: `${selectedParty.fullName} — ledger`,
          columns: ['Date', 'Description', 'Debit', 'Credit', config.balanceLabel],
          rows: rows.map((r) => [fmtDate(r.date), r.description, r.debit, r.credit, r.balance]),
        },
      ]
    : []

  return (
    <div className="report-panel">
      <div className="field" style={{ maxWidth: 360 }}>
        <label>{config.pickerLabel}</label>
        <SearchableSelect
          items={parties}
          value={partyId}
          onChange={setPartyId}
          getId={(p) => p.id}
          getLabel={(p) => p.label}
          placeholder={`— Select ${config.pickerLabel.toLowerCase()} —`}
        />
      </div>

      {partyId && (
        <ReportExportButtons
          title={`${selectedParty?.fullName ?? ''} ledger`}
          sections={sections}
          range={null}
          style={{ marginTop: 12 }}
          headerNote={selectedParty?.gst ?? undefined}
          fileNamePrefix={`${selectedParty?.label ?? 'Ledger'}_Ledger`}
        />
      )}

      {!partyId ? (
        <div className="note" style={{ marginTop: 16 }}>
          Pick a {config.pickerLabel.toLowerCase()} to see their ledger.
        </div>
      ) : (
        <div className="table-scroll" style={{ marginTop: 16 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Debit</th>
                <th style={{ textAlign: 'right' }}>Credit</th>
                <th style={{ textAlign: 'right' }}>{config.balanceLabel}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    No transactions yet
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.description}</td>
                  <td className="amt">{r.debit ? fmt(r.debit) : '—'}</td>
                  <td className="amt">{r.credit ? fmt(r.credit) : '—'}</td>
                  <td className="amt">{fmt(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
