import { utils as XLSXUtils, writeFile as writeExcelFile } from "xlsx";
import { jsPDF } from "jspdf";
import autoTable, { CellInput } from "jspdf-autotable";
import Papa from "papaparse";

export function exportToCsv(filename: string, data: Record<string, unknown>[]) {
  const csv = Papa.unparse(data, {
    quotes: true, // Forçar aspas em todos os campos para garantir que campos longos não sejam cortados
    escapeChar: '"',
    delimiter: ',',
  });
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
  
  // Ajustar largura das colunas automaticamente
  const colWidths: { wch: number }[] = [];
  const range = XLSXUtils.decode_range(worksheet["!ref"] || "A1");
  
  for (let C = range.s.c; C <= range.e.c; ++C) {
    let maxWidth = 10;
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cellAddress = XLSXUtils.encode_cell({ c: C, r: R });
      const cell = worksheet[cellAddress];
      if (cell && cell.v) {
        const cellValue = String(cell.v);
        // Para a coluna de Notas, permitir largura maior
        if (cellValue.length > maxWidth) {
          maxWidth = Math.min(cellValue.length + 2, 100); // Máximo de 100 caracteres de largura
        }
      }
    }
    colWidths.push({ wch: maxWidth });
  }
  worksheet["!cols"] = colWidths;
  
  const workbook = XLSXUtils.book_new();
  XLSXUtils.book_append_sheet(workbook, worksheet, "Dados");
  writeExcelFile(workbook, filename);
}

