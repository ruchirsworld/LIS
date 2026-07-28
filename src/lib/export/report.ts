// jspdf/jspdf-autotable/xlsx are dynamically imported below rather than
// imported at module scope — jsPDF alone pulls in ~400KB of dependencies
// (html2canvas, dompurify) that every page load would otherwise pay for,
// even for users who never open Reports or click a download button.

export interface ExportSection {
  title: string
  columns: string[]
  rows: (string | number)[][]
}

function fileStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

function fileSafe(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '_')
}

export async function exportReportPdf(reportTitle: string, sections: ExportSection[], periodLabel: string): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])

  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.setTextColor(20)
  doc.text(reportTitle, 14, 16)
  doc.setFontSize(10)
  doc.setTextColor(110)
  doc.text(periodLabel, 14, 22)

  let cursorY = 30
  for (const section of sections) {
    if (cursorY > 270) {
      doc.addPage()
      cursorY = 20
    }
    doc.setFontSize(11)
    doc.setTextColor(20)
    doc.text(section.title, 14, cursorY)
    autoTable(doc, {
      startY: cursorY + 3,
      head: [section.columns],
      body: section.rows.length > 0 ? section.rows.map((r) => r.map((c) => String(c))) : [['No data in this period']],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [47, 107, 64] },
      margin: { left: 14, right: 14 },
    })
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12
  }

  doc.save(`${fileSafe(reportTitle)}_${fileStamp()}.pdf`)
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

export async function exportReportExcel(reportTitle: string, sections: ExportSection[], periodLabel: string): Promise<void> {
  // SheetJS's npm package has two known CVEs (prototype pollution, ReDoS) —
  // both only reachable via XLSX.read/readFile on untrusted input. This
  // function only ever calls the write-side APIs (book_new/aoa_to_sheet/
  // book_append_sheet/writeFile) against our own trusted report data, so
  // that attack surface doesn't apply here.
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()
  const usedNames = new Set<string>()
  for (const section of sections) {
    const sheetData = [[reportTitle], [periodLabel], [], section.columns, ...section.rows]
    const ws = XLSX.utils.aoa_to_sheet(sheetData)
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(section.title, usedNames))
  }
  XLSX.writeFile(wb, `${fileSafe(reportTitle)}_${fileStamp()}.xlsx`)
}
