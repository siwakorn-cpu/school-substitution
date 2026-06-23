import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { formatThaiDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { canViewReports } from "@/lib/rbac";
import { buildSubstitutionReportWhere, currentMonthInputValue, normalizeRange } from "@/lib/reportFilters";
import { getTermOptions } from "@/lib/terms";

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<{ range?: string; date?: string; month?: string; term?: string; departmentId?: string }>;
}) {
  const user = await requireUser();
  if (!(await canViewReports(user))) {
    return (
      <AppShell user={user}>
        <p className="error">บัญชีนี้ไม่มีสิทธิ์ดูรายงานรวม</p>
      </AppShell>
    );
  }

  const params = await searchParams;
  const range = normalizeRange(params.range);
  const selectedMonth = params.month || currentMonthInputValue();
  const selectedDate = params.date || new Date().toISOString().slice(0, 10);
  const [termData, departments] = await Promise.all([
    getTermOptions(),
    prisma.department.findMany({ orderBy: { name: "asc" } })
  ]);
  const selectedTerm = params.term || termData.currentTerm;
  const selectedDepartmentId = departments.some((department) => department.id === params.departmentId)
    ? params.departmentId ?? "all"
    : "all";
  const selectedDepartment =
    selectedDepartmentId === "all" ? null : departments.find((department) => department.id === selectedDepartmentId) ?? null;
  const report = buildSubstitutionReportWhere({
    range,
    date: selectedDate,
    month: selectedMonth,
    term: selectedTerm
  });
  const exportParams = new URLSearchParams({
    range,
    date: selectedDate,
    month: selectedMonth,
    term: selectedTerm,
    departmentId: selectedDepartmentId
  });
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
  const rows = teachers
    .map((teacher) => ({
      id: teacher.id,
      code: teacher.code,
      name: teacher.name,
      department: teacher.department.name,
      count: countMap.get(teacher.id) ?? 0
    }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  const max = Math.max(1, ...rows.map((row) => row.count));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>Dashboard สถิติ</h1>
          <p className="muted">เปรียบเทียบภาระการเข้าแทนครูแต่ละคน · {reportLabel}</p>
        </div>
        <a className="btn primary" href={`/api/reports/export?${exportParams.toString()}`}>
          Export CSV
        </a>
      </div>

      <section className="grid">
        <div className="card">
          <h2>เลือกช่วงรายงาน</h2>
          <form className="form" method="get">
            <div className="form-row">
              <label>
                ประเภทรายงาน
                <select name="range" defaultValue={range}>
                  <option value="day">รายวัน</option>
                  <option value="month">รายเดือน</option>
                  <option value="term">รายภาคเรียน</option>
                </select>
              </label>
              <label>
                วันที่
                <input name="date" type="date" defaultValue={selectedDate} />
              </label>
            </div>
            <div className="form-row">
              <label>
                เดือน
                <input name="month" type="month" defaultValue={selectedMonth} />
              </label>
              <label>
                ภาคเรียน
                <select name="term" defaultValue={selectedTerm}>
                  {termData.terms.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                กลุ่มสาระ
                <select name="departmentId" defaultValue={selectedDepartmentId}>
                  <option value="all">ทุกกลุ่มสาระ</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button className="btn primary" type="submit">
              แสดงรายงาน
            </button>
          </form>
        </div>

        <div className="card span-4 stat">
          <span className="muted">คาบเข้าแทนรวม</span>
          <strong>{total}</strong>
        </div>
        <div className="card span-4 stat">
          <span className="muted">เข้าแทนมากที่สุด</span>
          <strong>{rows[0]?.count ?? 0}</strong>
        </div>
        <div className="card span-4 stat">
          <span className="muted">ครูในรายงาน</span>
          <strong>{rows.length}</strong>
        </div>

        <div className="card">
          <h2>รายละเอียดการสอนแทน</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่ลา</th>
                  <th>ชื่อครูที่ลา</th>
                  <th>คาบ</th>
                  <th>รหัสวิชา</th>
                  <th>วิชา</th>
                  <th>ห้อง ม.</th>
                  <th>ห้องเรียน</th>
                  <th>ชื่อครูที่สอนแทน</th>
                </tr>
              </thead>
              <tbody>
                {substitutionDetails.length === 0 ? (
                  <tr>
                    <td className="muted" colSpan={8}>
                      ไม่พบข้อมูลการสอนแทนในช่วงนี้
                    </td>
                  </tr>
                ) : (
                  substitutionDetails.map((item) => {
                    const schedule = item.absencePeriod.schedule;
                    const substituteTeacher = substituteTeacherMap.get(item.substituteTeacherId);

                    return (
                      <tr key={item.id}>
                        <td>{formatThaiDate(item.absencePeriod.absence.date)}</td>
                        <td className="no-glossary">{item.absencePeriod.absence.teacher.name}</td>
                        <td>{item.period}</td>
                        <td>{schedule.subject.code || "-"}</td>
                        <td>{schedule.subject.name}</td>
                        <td>{schedule.classRoom.name}</td>
                        <td>{schedule.specialRoom?.name ?? schedule.classRoom.name}</td>
                        <td className="no-glossary">
                          {substituteTeacher
                            ? `${substituteTeacher.code} - ${substituteTeacher.name}`
                            : "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>ภาระการเข้าแทน</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ครู</th>
                  <th>กลุ่มสาระ</th>
                  <th>จำนวนคาบ</th>
                  <th>กราฟ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="no-glossary">
                      {row.code} - {row.name}
                    </td>
                    <td>{row.department}</td>
                    <td>{row.count}</td>
                    <td>
                      <div className="bar" aria-label={`${row.count} คาบ`}>
                        <span style={{ width: `${(row.count / max) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
