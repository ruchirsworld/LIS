// jspdf/jspdf-autotable/xlsx are dynamically imported below rather than
// imported at module scope — jsPDF alone pulls in ~400KB of dependencies
// (html2canvas, dompurify) that every page load would otherwise pay for,
// even for users who never open Reports or click a download button. The
// embedded font and logo (below) follow the same lazy-loading rule.

import { fmt } from '../calc/format'

export interface ExportSection {
  title: string
  columns: string[]
  rows: (string | number)[][]
}

// DD-MM-YYYY, matching the date format used everywhere else user-facing in
// this app (Excel uploads, on-screen dates via fmtDate).
function fileStamp(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${d.getFullYear()}`
}

function fileSafe(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '_')
}

/** A column where every row's value is a number is a currency amount in
 * every report this app exports (never a bare count or percentage) — so it
 * gets right-aligned and rendered with fmt()'s ₹ formatting, same as the
 * on-screen tables. */
function numericColumnIndexes(rows: (string | number)[][]): number[] {
  if (rows.length === 0) return []
  const colCount = rows[0].length
  const idxs: number[] = []
  for (let c = 0; c < colCount; c++) {
    if (rows.every((r) => typeof r[c] === 'number')) idxs.push(c)
  }
  return idxs
}

export async function exportReportPdf(
  reportTitle: string,
  sections: ExportSection[],
  periodLabel: string,
  headerNote?: string,
  fileNamePrefix?: string
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }, { NOTO_SANS_SUBSET_BASE64 }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    import('../../assets/fonts/notoSansLedgerFont'),
  ])

  const doc = new jsPDF()

  // jsPDF's built-in fonts (Helvetica/Times/Courier) predate Unicode
  // currency symbols and render ₹ as a blank box — embed a real font
  // instead. Registered under both styles since only one weight was
  // subsetted; autoTable's default head style asks for 'bold' and would
  // otherwise fail to resolve it.
  doc.addFileToVFS('NotoSans-Regular.ttf', NOTO_SANS_SUBSET_BASE64)
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'bold')
  doc.setFont('NotoSans', 'normal')

  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 14
  const brandGreen: [number, number, number] = [47, 107, 64]
  const ink = 20
  const inkSoft = 110

  // The small square brand mark (not the wide wordmark logo used
  // elsewhere) — served from /public, so it's a plain root-relative fetch
  // rather than a bundled asset import.
  let logoDataUrl: string | null = null
  try {
    const blob = await (await fetch('/icon-192.png')).blob()
    logoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    logoDataUrl = null
  }

  const logoSize = 12
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', pageWidth - marginX - logoSize, 12, logoSize, logoSize)
  }

  doc.setFontSize(17)
  doc.setTextColor(ink)
  doc.text(reportTitle, marginX, 20)

  // Extra identifying detail for the party a ledger/statement is about
  // (currently just a client's GST no.) — printed right under the title,
  // above the "As of ..." period line.
  let y = 20
  if (headerNote) {
    y += 6
    doc.setFontSize(9.5)
    doc.setTextColor(inkSoft)
    doc.text(headerNote, marginX, y)
  }

  y += 7
  doc.setFontSize(10)
  doc.setTextColor(inkSoft)
  doc.text(periodLabel, marginX, y)

  const ruleY = Math.max(y + 5, 12 + logoSize + 4)
  doc.setDrawColor(220)
  doc.setLineWidth(0.3)
  doc.line(marginX, ruleY, pageWidth - marginX, ruleY)

  let cursorY = ruleY + 8
  for (const section of sections) {
    if (cursorY > 260) {
      doc.addPage()
      cursorY = 20
    }
    if (sections.length > 1) {
      doc.setFontSize(11)
      doc.setTextColor(ink)
      doc.setFont('NotoSans', 'bold')
      doc.text(section.title, marginX, cursorY)
      doc.setFont('NotoSans', 'normal')
      cursorY += 5
    }

    const numericCols = numericColumnIndexes(section.rows)
    const columnStyles = Object.fromEntries(numericCols.map((i) => [i, { halign: 'right' as const }]))

    autoTable(doc, {
      startY: cursorY,
      head: [section.columns],
      body:
        section.rows.length > 0
          ? section.rows.map((r) => r.map((c) => (typeof c === 'number' ? fmt(c) : String(c))))
          : [['No data in this period']],
      styles: { font: 'NotoSans', fontStyle: 'normal', fontSize: 9, textColor: ink, lineColor: 225, lineWidth: 0.1 },
      headStyles: { font: 'NotoSans', fontStyle: 'bold', fillColor: brandGreen, textColor: 255, halign: 'left' },
      alternateRowStyles: { fillColor: [246, 248, 246] },
      columnStyles,
      margin: { left: marginX, right: marginX },
      theme: 'grid',
    })
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12
  }

  // Footer — brand line + page numbers on every page, added last so the
  // final page count is known.
  const pageCount = doc.getNumberOfPages()
  const pageHeight = doc.internal.pageSize.getHeight()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setDrawColor(230)
    doc.setLineWidth(0.2)
    doc.line(marginX, pageHeight - 14, pageWidth - marginX, pageHeight - 14)
    doc.setFont('NotoSans', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(inkSoft)
    doc.text('Laavin InfraScapes — system-generated document', marginX, pageHeight - 9)
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - marginX, pageHeight - 9, { align: 'right' })
  }

  doc.save(`${fileSafe(fileNamePrefix ?? reportTitle)}_${fileStamp()}.pdf`)
}

function sanitizeSheetName(name: string, used: Set<string>): string {
  const base = (name.replace(/[\\/*?:[\]]/g, ' ').trim() || 'Sheet').slice(0, 31)
  let candidate = base
  let n = 2
  while (used.has(candidate)) {
    candidate = `${base.slice(0, 28)} ${n}`
    n++
  }
  used.add(candidate)
  return candidate
}

export async function exportReportExcel(
  reportTitle: string,
  sections: ExportSection[],
  periodLabel: string,
  headerNote?: string,
  fileNamePrefix?: string
): Promise<void> {
  // SheetJS's npm package has two known CVEs (prototype pollution, ReDoS) —
  // both only reachable via XLSX.read/readFile on untrusted input. This
  // function only ever calls the write-side APIs (book_new/aoa_to_sheet/
  // book_append_sheet/writeFile) against our own trusted report data, so
  // that attack surface doesn't apply here.
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()
  const usedNames = new Set<string>()
  for (const section of sections) {
    const sheetData = [
      [reportTitle],
      ...(headerNote ? [[headerNote]] : []),
      [periodLabel],
      [],
      section.columns,
      ...section.rows,
    ]
    const ws = XLSX.utils.aoa_to_sheet(sheetData)
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(section.title, usedNames))
  }
  XLSX.writeFile(wb, `${fileSafe(fileNamePrefix ?? reportTitle)}_${fileStamp()}.xlsx`)
}
