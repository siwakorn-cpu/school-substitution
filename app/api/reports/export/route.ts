import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewReports } from "@/lib/rbac";
import { buildSubstitutionReportWhere } from "@/lib/reportFilters";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await canViewReports(user))) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const report = buildSubstitutionReportWhere({
    range: url.searchParams.get("range") ?? undefined,
    date: url.searchParams.get("date") ?? undefined,
    month: url.searchParams.get("month") ?? undefined,
    term: url.searchParams.get("term") ?? undefined
  });
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  const departmentId = url.searchParams.get("departmentId") ?? "all";
  const selectedDepartment =
    departmentId === "all" ? null : departments.find((department) => department.id === departmentId) ?? null;
  const reportLabel = selectedDepartment ? `${report.label} · กลุ่มสาระ ${selectedDepartment.name}` : report.label;

  const teachers = await prisma.teacher.findMany({
    where: selectedDepartment ? { departmentId: selectedDepartment.id } : {},
    include: { department: true },
    orderBy: { code: "asc" }
  });
  const reportWhere = selectedDepartment
    ? { ...report.where, substituteTeacherId: { in: teachers.map((teacher) => teacher.id) } }
    : report.where;
  const [counts, substitutionDetails] = await Promise.all([
    prisma.substitution.groupBy({
      by: ["substituteTeacherId"],
      where: reportWhere,
      _count: { _all: true }
    }),
    prisma.substitution.findMany({
      where: reportWhere,
      include: {
        absencePeriod: {
          include: {
            absence: { include: { teacher: true } },
            schedule: {
              include: {
                subject: true,
                classRoom: true,
                specialRoom: true
              }
            }
          }
        }
      },
      orderBy: [{ date: "desc" }, { period: "asc" }]
    })
  ]);
  const substituteTeacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const countMap = new Map(counts.map((item) => [item.substituteTeacherId, item._count._all]));
  const lines = [
    ["ช่วงรายงาน", reportLabel],
    ["รหัสครู", "ชื่อครู", "กลุ่มสาระ", "จำนวนคาบเข้าแทน"],
    ...teachers.map((teacher) => [
      teacher.code,
      teacher.name,
      teacher.department.name,
      String(countMap.get(teacher.id) ?? 0)
    ]),
    [],
    ["รายละเอียดการสอนแทน"],
    ["ชื่อครูที่ลา", "คาบ", "รหัสวิชา", "วิชา", "ห้อง ม.", "ห้องเรียน", "ชื่อครูที่สอนแทน"],
    ...substitutionDetails.map((item) => {
      const schedule = item.absencePeriod.schedule;
      const substituteTeacher = substituteTeacherMap.get(item.substituteTeacherId);

      return [
        item.absencePeriod.absence.teacher.name,
        String(item.period),
        schedule.subject.code || "-",
        schedule.subject.name,
        schedule.classRoom.name,
        schedule.specialRoom?.name ?? schedule.classRoom.name,
        substituteTeacher ? `${substituteTeacher.code} - ${substituteTeacher.name}` : "-"
      ];
    })
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
