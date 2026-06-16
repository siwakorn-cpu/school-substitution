import { requireAdmin } from "@/lib/auth";
import { createWorkbook } from "@/lib/excel";

const headers = ["username", "password", "role", "teacher_code", "is_active"];
const sampleRows = [
  ["teacher001", "teacher1234", "TEACHER", "T001", "TRUE"],
  ["personnel01", "person1234", "PERSONNEL", "", "TRUE"],
  ["deptrep01", "dept1234", "DEPT_REP", "T003", "TRUE"]
];

export async function GET(request: Request) {
  await requireAdmin();
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  if (format === "csv") {
    const csv = [headers, ...sampleRows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="user-import-template.csv"'
      }
    });
  }

  const buffer = await createWorkbook("ผู้ใช้", [headers, ...sampleRows], [18, 16, 14, 14, 10]);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="user-import-template.xlsx"'
    }
  });
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
