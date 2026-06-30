import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatThaiDate, thaiDays, toDateInputValue } from "@/lib/date";
import { roleLabel } from "@/lib/permissions";
import { getDepartmentScopeId, roleUsesDepartmentScope } from "@/lib/departmentScope";
import { getTermOptions } from "@/lib/terms";
import { ShareSubstitutionImage, type ShareSubstitutionData } from "@/components/ShareSubstitutionImage";

const scheduleWeekdays = [1, 2, 3, 4, 5];
const schedulePeriods = Array.from({ length: 10 }, (_, index) => index + 1);

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
      prisma.substitution.count({ where: { date: { gte: monthStart, lt: monthEnd }, status: "APPROVED" } }),
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
      prisma.substitution.count({ where: { date: { gte: monthStart, lt: monthEnd }, status: "APPROVED" } })
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

  const [mySubstitutions, myTeacher] = user.teacherId
    ? await Promise.all([
        prisma.substitution.findMany({
          where: { substituteTeacherId: user.teacherId },
          orderBy: { date: "desc" },
          take: 50,
          include: {
            absencePeriod: {
              include: {
                absence: { include: { teacher: true } },
                schedule: { include: { subject: true, classRoom: true, specialRoom: true } }
              }
            }
          }
        }),
        prisma.teacher.findUnique({ where: { id: user.teacherId } })
      ])
    : [[], null];

  const { currentTerm } = await getTermOptions();
  const mySchedules = user.teacherId
    ? await prisma.teachingSchedule.findMany({
        where: { teacherId: user.teacherId, term: currentTerm },
        include: { classRoom: true, subject: true, specialRoom: true },
        orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }]
      })
    : [];
  const scheduleByDayPeriod = new Map(
    mySchedules.map((schedule) => [`${schedule.dayOfWeek}-${schedule.period}`, schedule])
  );

  const myName = myTeacher ? `${myTeacher.code} - ${myTeacher.name}` : "";
  const mySubstitutionItems: ShareSubstitutionData[] = mySubstitutions.map((item) => ({
    date: formatThaiDate(item.absencePeriod.absence.date),
    period: item.period,
    classRoom: item.absencePeriod.schedule.classRoom.name,
    subject: item.absencePeriod.schedule.subject.name,
    originalTeacher: item.absencePeriod.absence.teacher.name,
    specialRoom: item.absencePeriod.schedule.specialRoom?.name ?? null,
    substituteTeacher: myName,
    note: item.note
  }));

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
            <h2>ตารางสอนของฉัน</h2>
            <p className="muted">ภาคเรียน {currentTerm}</p>
            {mySchedules.length === 0 ? (
              <p className="muted">ยังไม่มีตารางสอนในภาคเรียนนี้</p>
            ) : (
              <div className="table-wrap">
                <table className="weekly-schedule-table mini-schedule-table">
                  <thead>
                    <tr>
                      <th>วัน</th>
                      {schedulePeriods.map((period) => (
                        <th key={period}>{period}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleWeekdays.map((dayIndex) => (
                      <tr key={dayIndex}>
                        <th>{thaiDays[dayIndex]}</th>
                        {schedulePeriods.map((period) => {
                          const schedule = scheduleByDayPeriod.get(`${dayIndex}-${period}`);
                          return (
                            <td key={period}>
                              {schedule ? (
                                <div className="mini-schedule-cell">
                                  <strong>
                                    {schedule.subject.code ? `${schedule.subject.code} ` : ""}
                                    {schedule.subject.name}
                                  </strong>
                                  <span>{schedule.classRoom.name}</span>
                                  {schedule.specialRoom ? <span>{schedule.specialRoom.name}</span> : null}
                                </div>
                              ) : (
                                <span className="muted">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {user.teacherId ? (
          <div className="card span-12">
            <h2>รายการสอนแทนของฉัน</h2>
            {mySubstitutionItems.length === 0 ? (
              <p className="muted">ยังไม่มีรายการสอนแทนล่าสุด</p>
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>วันที่</th>
                        <th>คาบ</th>
                        <th>ม.</th>
                        <th>วิชา</th>
                        <th>ครูเดิม</th>
                        <th>ห้อง/อาคาร</th>
                        <th>ครูสอนแทน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mySubstitutionItems.map((item, index) => (
                        <tr key={`${item.date}-${item.period}-${item.classRoom}-${index}`}>
                          <td>{item.date}</td>
                          <td>{item.period}</td>
                          <td>{item.classRoom}</td>
                          <td>{item.subject}</td>
                          <td className="no-glossary">{item.originalTeacher}</td>
                          <td>{item.specialRoom || "-"}</td>
                          <td className="no-glossary">{item.substituteTeacher}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ShareSubstitutionImage
                  title="รายการสอนแทนของฉัน"
                  subtitle={myTeacher ? `ครูสอนแทน: ${myTeacher.name}` : undefined}
                  filename={`สอนแทน-${myTeacher?.name ?? "ฉัน"}`}
                  items={mySubstitutionItems}
                />
              </>
            )}
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
