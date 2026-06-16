import ExcelJS from "exceljs";

export async function readFirstWorksheet<T>(bytes: Buffer): Promise<T[]> {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1);
  const rows: T[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const record: Record<string, string> = {};
    let hasValue = false;
    for (let column = 1; column <= worksheet.columnCount; column += 1) {
      const header = headerRow.getCell(column).text.trim();
      if (!header) continue;
      const value = row.getCell(column).text.trim();
      record[header] = value;
      if (value) hasValue = true;
    }

    if (hasValue) rows.push(record as T);
  });

  return rows;
}

export async function createWorkbook(
  sheetName: string,
  rows: string[][],
  columnWidths: number[]
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.addRows(rows);
  worksheet.columns = columnWidths.map((width) => ({ width }));
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  return Buffer.from(new Uint8Array(await workbook.xlsx.writeBuffer()));
}
