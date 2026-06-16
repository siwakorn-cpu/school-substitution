import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatThaiDate, toDateInputValue } from "@/lib/date";

export default async function DashboardPage() {
  const user = await requireUser();
  const today = new Date(`${toDateInputValue()}T00:00:00`);

  const [teacherCount, pendingAbsencePeriods, pendingSwaps, monthSubstitutions, mySubstitutions] =
    await Promise.all([
      prisma.teacher.count({ where: { status: "ACTIVE" } }),
      prisma.absencePeriod.count({ where: { status: "PENDING" } }),
      prisma.swapRequest.count({ where: { status: "PENDING" } }),
      prisma.substitution.count({
        where: {
          date: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1),
            lt: new Date(today.getFullYear(), today.getMonth() + 1, 1)
          }
        }
      }),
      user.teacherId
        ? prisma.substitution.findMany({
            where: { substituteTeacherId: user.teacherId },
            orderBy: { date: "desc" },
            take: 5
          })
        : []
    ]);

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>ภาพรวมระบบ</h1>
          <p className="muted">ข้อมูลประจำวันที่ {formatThaiDate(today)}</p>
        </div>
      </div>

      <section className="grid">
        <div className="card span-4 stat">
          <span className="muted">ครูที่ใช้งานอยู่</span>
          <strong>{teacherCount}</strong>
        </div>
        <div className="card span-4 stat">
          <span className="muted">คาบรอจัดการ</span>
          <strong>{pendingAbsencePeriods}</strong>
        </div>
        <div className="card span-4 stat">
          <span className="muted">แลกคาบรออนุมัติ</span>
          <strong>{pendingSwaps}</strong>
        </div>
        <div className="card span-6 stat">
          <span className="muted">สอนแทนเดือนนี้</span>
          <strong>{monthSubstitutions}</strong>
        </div>
        <div className="card span-6">
          <h2>รายการของฉัน</h2>
          {mySubstitutions.length === 0 ? (
            <p className="muted">ยังไม่มีรายการสอนแทนล่าสุด</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>คาบ</th>
                    <th>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {mySubstitutions.map((item) => (
                    <tr key={item.id}>
                      <td>{formatThaiDate(item.date)}</td>
                      <td>{item.period}</td>
                      <td>{item.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
