import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSubstitutionReportWhere } from "@/lib/reportFilters";

export async function GET(request: Request) {
  const user = await requireUser();
  if (user.role === "TEACHER" || user.role === "DEPT_REP") {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const report = buildSubstitutionReportWhere({
    range: url.searchParams.get("range") ?? undefined,
    date: url.searchParams.get("date") ?? undefined,
    month: url.searchParams.get("month") ?? undefined,
    term: url.searchParams.get("term") ?? undefined
  });

  const [teachers, counts] = await Promise.all([
    prisma.teacher.findMany({
    include: { department: true },
    orderBy: { code: "asc" }
    }),
    prisma.substitution.groupBy({
    by: ["substituteTeacherId"],
      where: report.where,
    _count: { _all: true }
    })
  ]);
  const countMap = new Map(counts.map((item) => [item.substituteTeacherId, item._count._all]));
  const lines = [
    ["ช่วงรายงาน", report.label],
    ["รหัสครู", "ชื่อครู", "กลุ่มสาระ", "จำนวนคาบเข้าแทน"],
    ...teachers.map((teacher) => [
      teacher.code,
      teacher.name,
      teacher.department.name,
      String(countMap.get(teacher.id) ?? 0)
    ])
  ];
  const csv = lines.map((line) => line.map(escapeCsv).join(",")).join("\n");

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="substitution-load-report.csv"'
    }
  });
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
