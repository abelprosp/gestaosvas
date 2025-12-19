import { utils as XLSXUtils, writeFile as writeExcelFile, read as readExcelFile } from "xlsx";
import { jsPDF } from "jspdf";
import autoTable, { CellInput } from "jspdf-autotable";

// Função de exportação para Excel (substitui exportToCsv)
export function exportToExcel(filename: string, data: Record<string, unknown>[]) {
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

// Função de importação de Excel (substitui parsing de CSV)
export function importFromExcel<T = Record<string, unknown>>(
  file: File,
  onComplete: (data: T[], errors: string[]) => void
): void {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const data = e.target?.result;
      if (!data) {
        onComplete([], ["Erro ao ler arquivo"]);
        return;
      }
      
      const workbook = readExcelFile(data, { type: "binary" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Converter para JSON diretamente (header: true usa primeira linha como chaves)
      const jsonData = XLSXUtils.sheet_to_json<T>(worksheet, {
        header: 1, // Primeiro obter como array para verificar linhas vazias
        defval: "",
        raw: false,
      });
      
      if (jsonData.length === 0) {
        onComplete([], ["Arquivo Excel vazio"]);
        return;
      }
      
      // Converter para objetos usando primeira linha como header
      const result = XLSXUtils.sheet_to_json<T>(worksheet, {
        header: 1,
        defval: "",
        raw: false,
      }) as unknown[][];
      
      if (result.length === 0) {
        onComplete([], ["Arquivo Excel vazio"]);
        return;
      }
      
      const headers = result[0] as string[];
      const rows = result.slice(1);
      
      // Converter para objetos
      const objects: T[] = [];
      
      rows.forEach((row) => {
        // Pular linhas completamente vazias
        if (row.every((cell) => !cell || String(cell).trim() === "")) {
          return;
        }
        
        const obj: Record<string, unknown> = {};
        headers.forEach((header, colIndex) => {
          if (header && String(header).trim()) {
            obj[String(header).trim()] = row[colIndex] ?? "";
          }
        });
        
        objects.push(obj as T);
      });
      
      onComplete(objects, []);
    } catch (error) {
      onComplete([], [`Erro ao processar arquivo Excel: ${error instanceof Error ? error.message : String(error)}`]);
    }
  };
  
  reader.onerror = () => {
    onComplete([], ["Erro ao ler arquivo Excel"]);
  };
  
  reader.readAsBinaryString(file);
}

// Manter exportToCsv como alias para compatibilidade (deprecated)
/** @deprecated Use exportToExcel instead */
export function exportToCsv(filename: string, data: Record<string, unknown>[]) {
  // Substituir extensão .csv por .xlsx
  const excelFilename = filename.replace(/\.csv$/i, ".xlsx");
  exportToExcel(excelFilename, data);
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

// Manter exportToXlsx como alias para compatibilidade
export function exportToXlsx(filename: string, data: Record<string, unknown>[]) {
  exportToExcel(filename, data);
}

