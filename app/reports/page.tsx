import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSubstitutionReportWhere, currentMonthInputValue, normalizeRange } from "@/lib/reportFilters";

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<{ range?: string; date?: string; month?: string; term?: string }>;
}) {
  const user = await requireUser();
  if (user.role === "TEACHER" || user.role === "DEPT_REP") {
    return (
      <AppShell user={user}>
        <p className="error">บัญชีครูไม่มีสิทธิ์ดูรายงานรวม</p>
      </AppShell>
    );
  }

  const params = await searchParams;
  const range = normalizeRange(params.range);
  const selectedMonth = params.month || currentMonthInputValue();
  const selectedDate = params.date || new Date().toISOString().slice(0, 10);
  const terms = await prisma.teachingSchedule.findMany({
    distinct: ["term"],
    select: { term: true },
    orderBy: { term: "desc" }
  });
  const selectedTerm = params.term || terms[0]?.term || "1/2569";
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
    term: selectedTerm
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
          <p className="muted">เปรียบเทียบภาระการเข้าแทนครูแต่ละคน · {report.label}</p>
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
                  {terms.map((term) => (
                    <option key={term.term} value={term.term}>
                      {term.term}
                    </option>
                  ))}
                  {terms.length === 0 ? <option value="1/2569">1/2569</option> : null}
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
                    <td>
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
