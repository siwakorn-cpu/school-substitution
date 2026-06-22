import { requireUser } from "@/lib/auth";
import { createWorkbook } from "@/lib/excel";
import { canImportSchedule } from "@/lib/rbac";

const headers = ["teacher_code", "day", "period", "class_room", "subject_code", "subject", "room_building"];
const sampleRows = [
  ["T001", "จันทร์", "1", "ม.1/1", "ค21101", "คณิตศาสตร์", ""],
  ["T003", "อังคาร", "2-3", "ม.2/1", "ว21101", "วิทยาศาสตร์", "ห้องวิทย์ 1"],
  ["T006", "พุธ", "3", "ม.3/1", "อ21101", "ภาษาอังกฤษ", ""]
];

export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await canImportSchedule(user))) return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  if (format === "xlsx") {
    const buffer = await createWorkbook("ตารางสอน", [headers, ...sampleRows], [14, 12, 10, 14, 14, 18, 18]);

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="schedule-import-template.xlsx"'
      }
    });
  }

  const csv = [headers, ...sampleRows].map((row) => row.map(escapeCsv).join(",")).join("\n");

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="schedule-import-template.csv"'
    }
  });
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
