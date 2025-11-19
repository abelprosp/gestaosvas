import { utils as XLSXUtils, writeFile as writeExcelFile } from "xlsx";
import { jsPDF } from "jspdf";
import autoTable, { CellInput } from "jspdf-autotable";
import Papa from "papaparse";

export function exportToCsv(filename: string, data: Record<string, unknown>[]) {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToPdf(title: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [headers],
    body: rows.map((row) => row.map((value) => (value ?? "") as CellInput)),
  });
  doc.save(`${title.replace(/\s+/g, "_").toLowerCase()}.pdf`);
}

export function exportToXlsx(filename: string, data: Record<string, unknown>[]) {
  const worksheet = XLSXUtils.json_to_sheet(data);
  const workbook = XLSXUtils.book_new();
  XLSXUtils.book_append_sheet(workbook, worksheet, "Dados");
  writeExcelFile(workbook, filename);
}

