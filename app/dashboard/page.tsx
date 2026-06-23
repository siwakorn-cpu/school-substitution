import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatThaiDate, toDateInputValue } from "@/lib/date";
import { roleLabel } from "@/lib/permissions";
import { getDepartmentScopeId, roleUsesDepartmentScope } from "@/lib/departmentScope";

type StatCard = { label: string; value: number; href?: string; highlight?: boolean };

export default async function DashboardPage() {
  const user = await requireUser();
  const today = new Date(`${toDateInputValue()}T00:00:00`);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const isDeptScope = roleUsesDepartmentScope(user);
  const scopeId = isDeptScope ? await getDepartmentScopeId(user) : null;

  const cards: StatCard[] = [];

  if (user.role === "ADMIN") {
    const [teacherCount, pendingPeriods, pendingSwaps, monthSubstitutions, pendingUsers] = await Promise.all([
      prisma.teacher.count({ where: { status: "ACTIVE" } }),
      prisma.absencePeriod.count({ where: { status: "PENDING" } }),
      prisma.swapRequest.count({ where: { status: "PENDING" } }),
      prisma.substitution.count({ where: { date: { gte: monthStart, lt: monthEnd } } }),
      prisma.user.count({ where: { isActive: false } })
    ]);
    cards.push(
      { label: "ครูที่ใช้งานอยู่", value: teacherCount },
      { label: "คาบรอจัดสอนแทน", value: pendingPeriods, href: "/substitutions", highlight: pendingPeriods > 0 },
      { label: "แลกคาบรออนุมัติ", value: pendingSwaps, href: "/swaps", highlight: pendingSwaps > 0 },
      { label: "สอนแทนเดือนนี้", value: monthSubstitutions },
      { label: "ผู้ใช้รออนุมัติ", value: pendingUsers, href: "/users", highlight: pendingUsers > 0 }
    );
  } else if (user.role === "PERSONNEL") {
    const [absentToday, unassignedToday, pendingSwaps, monthSubstitutions] = await Promise.all([
      prisma.teacherAbsence.count({ where: { date: today } }),
      prisma.absencePeriod.count({ where: { status: "PENDING", absence: { date: today, type: "LEAVE" } } }),
      prisma.swapRequest.count({ where: { status: "PENDING" } }),
      prisma.substitution.count({ where: { date: { gte: monthStart, lt: monthEnd } } })
    ]);
    cards.push(
      { label: "ครูที่ลาวันนี้", value: absentToday, href: "/absences" },
      { label: "คาบที่ยังไม่จัดสอนแทนวันนี้", value: unassignedToday, href: "/substitutions", highlight: unassignedToday > 0 },
      { label: "แลกคาบรออนุมัติ", value: pendingSwaps, href: "/swaps", highlight: pendingSwaps > 0 },
      { label: "สอนแทนเดือนนี้", value: monthSubstitutions }
    );
  } else if (isDeptScope) {
    const [deptTeachers, deptPendingPeriods, deptPendingSwaps, myApprovals] = await Promise.all([
      prisma.teacher.count({ where: { status: "ACTIVE", departmentId: scopeId ?? "__none__" } }),
      prisma.absencePeriod.count({
        where: { status: "PENDING", absence: { teacher: { departmentId: scopeId ?? "__none__" } } }
      }),
      prisma.swapRequest.count({
        where: {
          status: "PENDING",
          OR: [
            { requesterTeacher: { departmentId: scopeId ?? "__none__" } },
            { targetTeacher: { departmentId: scopeId ?? "__none__" } }
          ]
        }
      }),
      user.teacherId
        ? prisma.swapRequest.count({ where: { targetTeacherId: user.teacherId, status: "PENDING" } })
        : Promise.resolve(0)
    ]);
    cards.push(
      { label: "ครูในกลุ่มสาระ", value: deptTeachers },
      { label: "คาบในกลุ่มรอจัดการ", value: deptPendingPeriods, href: "/substitutions", highlight: deptPendingPeriods > 0 },
      { label: "แลกคาบในกลุ่มรอดำเนินการ", value: deptPendingSwaps, href: "/swaps", highlight: deptPendingSwaps > 0 },
      { label: "ที่ฉันต้องอนุมัติ", value: myApprovals, href: "/swaps", highlight: myApprovals > 0 }
    );
  } else {
    // TEACHER — personal view only
    const [myApprovals, myOpenRequests, myAbsencesMonth] = await Promise.all([
      user.teacherId
        ? prisma.swapRequest.count({ where: { targetTeacherId: user.teacherId, status: "PENDING" } })
        : Promise.resolve(0),
      user.teacherId
        ? prisma.swapRequest.count({ where: { requesterTeacherId: user.teacherId, status: "PENDING" } })
        : Promise.resolve(0),
      user.teacherId
        ? prisma.teacherAbsence.count({ where: { teacherId: user.teacherId, date: { gte: monthStart, lt: monthEnd } } })
        : Promise.resolve(0)
    ]);
    cards.push(
      { label: "ที่ฉันต้องอนุมัติ", value: myApprovals, href: "/swaps", highlight: myApprovals > 0 },
      { label: "คำขอแลกคาบของฉันที่รออนุมัติ", value: myOpenRequests, href: "/swaps" },
      { label: "การลาของฉันเดือนนี้", value: myAbsencesMonth, href: "/absences" }
    );
  }

  const mySubstitutions = user.teacherId
    ? await prisma.substitution.findMany({
        where: { substituteTeacherId: user.teacherId },
        orderBy: { date: "desc" },
        take: 5
      })
    : [];

  const cardSpan = cards.length % 3 === 0 ? "span-4" : "span-6";

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>ภาพรวมระบบ</h1>
          <p className="muted">
            {roleLabel(user.role)} · ข้อมูลประจำวันที่ {formatThaiDate(today)}
          </p>
        </div>
      </div>

      <section className="grid">
        {cards.map((card) => {
          const className = `card ${cardSpan} stat${card.highlight ? " stat-alert" : ""}`;
          const content = (
            <>
              <span className="muted">{card.label}</span>
              <strong>{card.value}</strong>
            </>
          );
          return card.href ? (
            <Link className={className} href={card.href} key={card.label}>
              {content}
            </Link>
          ) : (
            <div className={className} key={card.label}>
              {content}
            </div>
          );
        })}

        {user.teacherId ? (
          <div className="card span-12">
            <h2>รายการสอนแทนของฉัน</h2>
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
        ) : null}
      </section>
    </AppShell>
  );
}
