// The tax invoice (and credit / debit note) as a PDF, laid out the way GST
// expects: supplier and recipient with GSTIN, place of supply, HSN/SAC, the
// taxable value with CGST / SGST / IGST shown separately, the invoice value in
// figures and in words, bank details and a signature block. Uses the same
// embedded font and the website palette as the report downloads, so avoid
// characters the font lacks (no multiplication sign, middle dot, or arrows).
import { fmt2, fmtDate } from '../calc/format'
import { amountInWords } from '../calc/words'
import { round2 } from '../calc/invoices'
import { stateCodeOfGstin, stateLabelOfGstin, stateNameOfCode } from '../gst'
import { CHARCOAL, CREAM, GREEN, HAIRLINE, MUTED } from './report'
import type { Database } from '../../types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']
type Client = Database['public']['Tables']['clients']['Row']
type Company = Database['public']['Tables']['company_profile']['Row']
type Project = Database['public']['Tables']['projects']['Row']
type InvoiceNote = Database['public']['Tables']['invoice_notes']['Row']

export interface TaxDocumentInput {
  invoice: Invoice
  client: Client | undefined
  company: Company | null | undefined
  project?: Project | null
  /** When set, the document is this credit / debit note against `invoice`. */
  note?: InvoiceNote
  dueDate?: string | null
}

function fileSafe(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '_')
}

function clientAddress(c: Client | undefined): string[] {
  if (!c) return []
  const cityLine = [c.city, c.state, c.pincode].map((p) => String(p ?? '').trim()).filter(Boolean).join(', ')
  return [String(c.address_line1 ?? '').trim(), cityLine].filter(Boolean)
}

export async function downloadTaxDocumentPdf(input: TaxDocumentInput): Promise<void> {
  const { invoice, client, company, project, note, dueDate } = input
  const [{ default: jsPDF }, { default: autoTable }, { NOTO_SANS_SUBSET_BASE64 }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    import('../../assets/fonts/notoSansLedgerFont'),
  ])

  const doc = new jsPDF()
  doc.addFileToVFS('NotoSans-Regular.ttf', NOTO_SANS_SUBSET_BASE64)
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'bold')
  doc.setFont('NotoSans', 'normal')

  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 14
  const rightX = pageWidth - marginX
  const text = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2])

  const isNote = !!note
  const kind = !note ? 'TAX INVOICE' : note.note_type === 'credit' ? 'CREDIT NOTE' : 'DEBIT NOTE'
  const docNumber = note ? note.display_id ?? '' : invoice.invoice_number ?? invoice.display_id ?? ''
  const docDate = note ? note.date : invoice.invoice_date ?? ''

  // Amounts on the document: the invoice as issued, or the note.
  const taxable = note ? Number(note.amount) : Number(invoice.amount)
  const gstPct = Number(note ? note.gst_pct : invoice.gst_pct || 0)
  const tdsPct = Number(note ? note.tds_pct : invoice.tds_pct || 0)
  const gst = note ? Number(note.gst_amount) : round2((taxable * gstPct) / 100)
  const tds = note ? Number(note.tds_amount) : round2((taxable * tdsPct) / 100)
  const invoiceValue = round2(taxable + gst)

  // Place of supply decides CGST + SGST (same state) or IGST.
  const companyState = stateCodeOfGstin(company?.gstin) || (company?.state_code ?? '')
  const clientState = stateCodeOfGstin(client?.gst)
  let cgst = 0
  let sgst = 0
  let igst = 0
  let unsplit = 0
  if (gst > 0) {
    if (companyState && clientState) {
      if (companyState === clientState) {
        cgst = round2(gst / 2)
        sgst = round2(gst - cgst)
      } else igst = gst
    } else unsplit = gst
  }
  const halfRate = gstPct / 2

  // ── Header: supplier on the left, document title on the right ───────────
  doc.setFontSize(15)
  text(GREEN)
  doc.setFont('NotoSans', 'bold')
  doc.text(company?.name || 'Laavin InfraScapes', marginX, 18)
  doc.setFont('NotoSans', 'normal')
  doc.setFontSize(8.5)
  text(MUTED)
  let y = 23
  for (const line of doc.splitTextToSize(company?.address ?? '', 100) as string[]) {
    if (!line) continue
    doc.text(line, marginX, y)
    y += 4
  }
  const idLine = [company?.gstin ? `GSTIN: ${company.gstin}` : '', company?.udyam_no ? `Udyam: ${company.udyam_no}` : ''].filter(Boolean).join('   |   ')
  if (idLine) {
    doc.text(idLine, marginX, y)
    y += 4
  }

  doc.setFontSize(17)
  text(GREEN)
  doc.setFont('NotoSans', 'bold')
  doc.text(kind, rightX, 18, { align: 'right' })
  doc.setFont('NotoSans', 'normal')
  doc.setFontSize(8.5)
  text(MUTED)
  doc.text('Original for recipient', rightX, 23, { align: 'right' })

  y = Math.max(y, 30) + 2
  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2])
  doc.setLineWidth(0.5)
  doc.line(marginX, y, rightX, y)
  y += 7

  // ── Document details (left) and recipient (right) ───────────────────────
  const midX = pageWidth / 2 + 4
  const detail = (label: string, value: string, atX: number, atY: number) => {
    doc.setFontSize(8)
    text(MUTED)
    doc.text(label, atX, atY)
    doc.setFontSize(9.5)
    text(CHARCOAL)
    doc.text(value, atX + 32, atY)
  }
  const placeOfSupply = stateLabelOfGstin(client?.gst) || (client?.state ? String(client.state) : '-')
  const original = invoice.invoice_number ?? invoice.display_id ?? ''
  let dy = y
  detail(isNote ? `${kind === 'CREDIT NOTE' ? 'Credit' : 'Debit'} note no.` : 'Invoice no.', docNumber, marginX, dy)
  dy += 5.5
  detail('Date', docDate ? fmtDate(docDate) : '-', marginX, dy)
  dy += 5.5
  if (isNote) {
    detail('Against invoice', `${original} dated ${invoice.invoice_date ? fmtDate(invoice.invoice_date) : '-'}`, marginX, dy)
    dy += 5.5
  } else if (dueDate) {
    detail('Due date', fmtDate(dueDate), marginX, dy)
    dy += 5.5
  }
  detail('Place of supply', placeOfSupply, marginX, dy)
  dy += 5.5
  if (project?.name) {
    detail('Project', project.name, marginX, dy)
    dy += 5.5
  }

  doc.setFontSize(8)
  text(MUTED)
  doc.text('Bill to', midX, y)
  doc.setFontSize(10.5)
  text(CHARCOAL)
  doc.setFont('NotoSans', 'bold')
  let by = y + 5
  for (const line of doc.splitTextToSize(client?.name ?? '-', rightX - midX) as string[]) {
    doc.text(line, midX, by)
    by += 4.8
  }
  doc.setFont('NotoSans', 'normal')
  doc.setFontSize(9)
  text(MUTED)
  for (const line of clientAddress(client)) {
    for (const part of doc.splitTextToSize(line, rightX - midX) as string[]) {
      doc.text(part, midX, by)
      by += 4.2
    }
  }
  doc.text(client?.gst ? `GSTIN: ${client.gst}` : 'GSTIN: unregistered', midX, by)
  by += 4.2
  const clientStateName = stateNameOfCode(clientState)
  if (clientStateName) {
    doc.text(`State: ${clientState} - ${clientStateName}`, midX, by)
    by += 4.2
  }

  y = Math.max(dy, by) + 4

  // ── Line item ───────────────────────────────────────────────────────────
  const taxHeads: { label: string; amount: number; rate: number }[] = []
  if (cgst || sgst) {
    taxHeads.push({ label: 'CGST', amount: cgst, rate: halfRate }, { label: 'SGST', amount: sgst, rate: halfRate })
  } else if (igst) {
    taxHeads.push({ label: 'IGST', amount: igst, rate: gstPct })
  } else if (unsplit) {
    taxHeads.push({ label: 'GST', amount: unsplit, rate: gstPct })
  }

  const description = note
    ? `${note.note_type === 'credit' ? 'Credit' : 'Debit'} note against invoice ${original}: ${note.reason}`
    : invoice.description || 'Services'

  autoTable(doc, {
    startY: y,
    head: [['No.', 'Description of services', 'HSN / SAC', 'Taxable value', ...taxHeads.map((t) => `${t.label} @${t.rate}%`)]],
    body: [['1', description, invoice.hsn_sac ?? '-', fmt2(taxable), ...taxHeads.map((t) => fmt2(t.amount))]],
    styles: { font: 'NotoSans', fontSize: 9, textColor: CHARCOAL, cellPadding: 2.4, lineColor: HAIRLINE, lineWidth: { bottom: 0.15 } },
    headStyles: { fillColor: CREAM, textColor: GREEN, fontStyle: 'bold', lineColor: GREEN, lineWidth: { bottom: 0.5 } },
    columnStyles: {
      0: { cellWidth: 12 },
      2: { cellWidth: 24 },
      3: { halign: 'right', cellWidth: 32 },
      ...Object.fromEntries(taxHeads.map((_, i) => [4 + i, { halign: 'right', cellWidth: 28 }])),
    },
    margin: { left: marginX, right: marginX },
    theme: 'plain',
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // ── Totals (right) ──────────────────────────────────────────────────────
  const totalsRight: [string, string, boolean?][] = [['Taxable value', fmt2(taxable)]]
  for (const t of taxHeads) totalsRight.push([`${t.label} @${t.rate}%`, fmt2(t.amount)])
  totalsRight.push([isNote ? `${kind === 'CREDIT NOTE' ? 'Credit' : 'Debit'} note value` : 'Invoice value', fmt2(invoiceValue), true])
  if (tds > 0) {
    totalsRight.push([`Less: TDS @${tdsPct}% (deducted by the recipient)`, `-${fmt2(tds)}`])
    totalsRight.push(['Net amount payable', fmt2(invoiceValue - tds), true])
  }
  const labelX = rightX - 62
  for (const [label, value, strong] of totalsRight) {
    doc.setFontSize(9)
    text(strong ? GREEN : MUTED)
    doc.setFont('NotoSans', strong ? 'bold' : 'normal')
    doc.text(label, labelX, y, { align: 'right' })
    text(strong ? GREEN : CHARCOAL)
    doc.text(value, rightX, y, { align: 'right' })
    y += 5.6
  }
  doc.setFont('NotoSans', 'normal')

  y += 2
  doc.setDrawColor(HAIRLINE[0], HAIRLINE[1], HAIRLINE[2])
  doc.setLineWidth(0.2)
  doc.line(marginX, y, rightX, y)
  y += 6
  doc.setFontSize(8)
  text(MUTED)
  doc.text('Amount in words', marginX, y)
  y += 4.6
  doc.setFontSize(9.5)
  text(CHARCOAL)
  for (const line of doc.splitTextToSize(amountInWords(invoiceValue), rightX - marginX) as string[]) {
    doc.text(line, marginX, y)
    y += 4.8
  }

  // ── Bank details and declaration ────────────────────────────────────────
  y += 4
  if (company?.bank_details?.trim()) {
    doc.setFontSize(8)
    text(MUTED)
    doc.text('Bank details for payment', marginX, y)
    y += 4.6
    doc.setFontSize(9)
    text(CHARCOAL)
    for (const line of company.bank_details.split('\n')) {
      for (const part of doc.splitTextToSize(line, 110) as string[]) {
        doc.text(part, marginX, y)
        y += 4.4
      }
    }
    y += 3
  }
  doc.setFontSize(8)
  text(MUTED)
  const declaration = isNote
    ? 'We declare that this note has been issued against the invoice stated above and that the particulars are true and correct.'
    : 'We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.'
  for (const line of doc.splitTextToSize(declaration, 110) as string[]) {
    doc.text(line, marginX, y)
    y += 4
  }

  // Signature block, anchored to the right of the declaration.
  const sigTop = y - 4
  doc.setFontSize(9)
  text(CHARCOAL)
  doc.text(`For ${company?.name || 'Laavin InfraScapes'}`, rightX, sigTop - 8, { align: 'right' })
  doc.setDrawColor(HAIRLINE[0], HAIRLINE[1], HAIRLINE[2])
  doc.line(rightX - 52, sigTop + 12, rightX, sigTop + 12)
  doc.setFontSize(8)
  text(MUTED)
  doc.text('Authorised signatory', rightX, sigTop + 16.5, { align: 'right' })

  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setDrawColor(HAIRLINE[0], HAIRLINE[1], HAIRLINE[2])
  doc.line(marginX, pageHeight - 14, rightX, pageHeight - 14)
  doc.setFontSize(8)
  text(MUTED)
  doc.text('This is a computer generated document and does not need a signature when sent electronically.', marginX, pageHeight - 9)

  doc.save(`${fileSafe(`${kind.replace(' ', '_')}_${docNumber || 'draft'}`)}.pdf`)
}
