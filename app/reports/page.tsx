import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { formatThaiDate, toDateInputValue } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { canViewReports } from "@/lib/rbac";
import {
  buildSubstitutionReportWhere,
  currentMonthInputValue,
  normalizeRange,
  parseDateInput,
  parseMonthInput
} from "@/lib/reportFilters";
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
  const selectedDate = params.date || toDateInputValue();
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
  // Audit trail (who recorded each substitution + when) — ADMIN only.
  const isAdmin = user.role === "ADMIN";
  const assignedByMap = new Map<string, string>();
  if (isAdmin && substitutionDetails.length > 0) {
    const assignedUsers = await prisma.user.findMany({
      where: { id: { in: Array.from(new Set(substitutionDetails.map((item) => item.assignedById))) } },
      select: { id: true, username: true }
    });
    for (const account of assignedUsers) assignedByMap.set(account.id, account.username);
  }
  const auditDateTime = (value: Date) =>
    new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short" }).format(value);
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

  // Leave summary (days) — ไม่มาปฏิบัติงาน + ลาป่วยล่วงหน้า นับรวมช่องเดียวกัน ส่วนลากิจแยกช่อง
  const leaveWhere: Prisma.TeacherAbsenceWhereInput = { type: { in: ["LEAVE", "SICK_ADVANCE", "PERSONAL"] } };
  if (range === "day") {
    const date = parseDateInput(selectedDate);
    if (date) {
      leaveWhere.date = { gte: date, lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1) };
    }
  } else if (range === "month") {
    const month = parseMonthInput(selectedMonth);
    if (month) {
      leaveWhere.date = { gte: month, lt: new Date(month.getFullYear(), month.getMonth() + 1, 1) };
    }
  } else if (range === "term") {
    leaveWhere.periods = { some: { schedule: { term: selectedTerm } } };
  }
  if (selectedDepartment) {
    leaveWhere.teacher = { departmentId: selectedDepartment.id };
  }

  const leaveCounts = await prisma.teacherAbsence.groupBy({
    by: ["teacherId", "type"],
    where: leaveWhere,
    _count: { _all: true }
  });
  const leaveByTeacher = new Map<string, { sick: number; personal: number }>();
  for (const item of leaveCounts) {
    const entry = leaveByTeacher.get(item.teacherId) ?? { sick: 0, personal: 0 };
    if (item.type === "LEAVE" || item.type === "SICK_ADVANCE") entry.sick += item._count._all;
    else if (item.type === "PERSONAL") entry.personal = item._count._all;
    leaveByTeacher.set(item.teacherId, entry);
  }
  const leaveRows = teachers
    .map((teacher) => {
      const entry = leaveByTeacher.get(teacher.id) ?? { sick: 0, personal: 0 };
      return {
        id: teacher.id,
        code: teacher.code,
        name: teacher.name,
        department: teacher.department.name,
        sick: entry.sick,
        personal: entry.personal,
        total: entry.sick + entry.personal
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));

  return (
    <AppShell user={user}>
      <div className="reports-compact">
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
                  {isAdmin ? <th>บันทึกโดย</th> : null}
                  {isAdmin ? <th>เวลาบันทึก</th> : null}
                </tr>
              </thead>
              <tbody>
                {substitutionDetails.length === 0 ? (
                  <tr>
                    <td className="muted" colSpan={isAdmin ? 10 : 8}>
                      ไม่พบข้อมูลการสอนแทนในช่วงนี้
                    </td>
                  </tr>
                ) : (
                  substitutionDetails.map((item) => {
                    const schedule = item.absencePeriod.schedule;
                    const substituteTeacher = item.substituteTeacherId
                      ? substituteTeacherMap.get(item.substituteTeacherId)
                      : null;
                    const substituteName = item.externalSubstituteName
                      ? `นิสิต/นักศึกษาฝึกประสบการณ์: ${item.externalSubstituteName}`
                      : substituteTeacher
                        ? `${substituteTeacher.code} - ${substituteTeacher.name}`
                        : "-";

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
                          {substituteName}
                        </td>
                        {isAdmin ? (
                          <td className="no-glossary">{assignedByMap.get(item.assignedById) ?? "ไม่ทราบ"}</td>
                        ) : null}
                        {isAdmin ? <td>{auditDateTime(item.createdAt)}</td> : null}
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

        <div className="card">
          <h2>สรุปจำนวนลา (วัน)</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ครู</th>
                  <th>กลุ่มสาระ</th>
                  <th>ไม่มาปฏิบัติงาน (วัน)</th>
                  <th>ลากิจ (วัน)</th>
                  <th>รวม (วัน)</th>
                </tr>
              </thead>
              <tbody>
                {leaveRows.length === 0 ? (
                  <tr>
                    <td className="muted" colSpan={5}>
                      ไม่พบข้อมูลการลาในช่วงนี้
                    </td>
                  </tr>
                ) : (
                  leaveRows.map((row) => (
                    <tr key={row.id}>
                      <td className="no-glossary">
                        {row.code} - {row.name}
                      </td>
                      <td>{row.department}</td>
                      <td>{row.sick}</td>
                      <td>{row.personal}</td>
                      <td>
                        <strong>{row.total}</strong>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      </div>
    </AppShell>
  );
}
