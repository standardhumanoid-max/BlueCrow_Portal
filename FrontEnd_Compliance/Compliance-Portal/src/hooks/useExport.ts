import { utils, writeFile } from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Excel export ─────────────────────────────────────────────────────────────
export function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const ws = utils.json_to_sheet(data)
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Dados')
  writeFile(wb, `${filename}.xlsx`)
}

// ─── PDF export ───────────────────────────────────────────────────────────────
export function exportToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const doc = new jsPDF({ orientation: 'landscape' })

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 18)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')}`, 14, 25)

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 30,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  })

  doc.save(`${filename}.pdf`)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useExport() {
  return { exportToExcel, exportToPDF }
}
