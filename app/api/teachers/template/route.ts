import { requireUser } from "@/lib/auth";
import { createWorkbook } from "@/lib/excel";
import { canManageTeacher } from "@/lib/rbac";

const headers = ["teacher_code", "teacher_name", "department", "status"];
const sampleRows = [
  ["T001", "ครูอรทัย ใจดี", "คณิตศาสตร์", "ACTIVE"],
  ["T002", "ครูสมชาย รักเรียน", "คณิตศาสตร์", "ACTIVE"],
  ["T003", "ครูวิภา แสงดาว", "วิทยาศาสตร์", "ACTIVE"]
];

export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await canManageTeacher(user))) return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  if (format === "csv") {
    const csv = [headers, ...sampleRows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="teacher-import-template.csv"'
      }
    });
  }

  const buffer = await createWorkbook("รายชื่อครู", [headers, ...sampleRows], [14, 24, 18, 12]);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="teacher-import-template.xlsx"'
    }
  });
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
