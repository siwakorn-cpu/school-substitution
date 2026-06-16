import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { canManageAbsence, canRecordOwnAbsence } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { dayOfWeekFromDate, formatThaiDate, parseDateInput, thaiDays, toDateInputValue } from "@/lib/date";

export default async function AbsencesPage({
  searchParams
}: {
  searchParams: Promise<{ date?: string; teacherId?: string }>;
}) {
  const user = await requireUser();
  const canManageAllAbsences = canManageAbsence(user);
  const canRecordOwn = canRecordOwnAbsence(user);
  if (!canManageAllAbsences && !canRecordOwn) {
    return (
      <AppShell user={user}>
        <p className="error">บัญชีนี้ไม่มีสิทธิ์บันทึกการลา/ไปราชการ</p>
      </AppShell>
    );
  }
  const params = await searchParams;
  const selectedDate = params.date ?? toDateInputValue();
  const selectedTeacherId = canManageAllAbsences ? params.teacherId ?? "" : user.teacherId ?? "";
  const date = parseDateInput(selectedDate);
  const dayOfWeek = dayOfWeekFromDate(date);

  const [teachers, schedules, absences] = await Promise.all([
    prisma.teacher.findMany({
      where: canManageAllAbsences
        ? { status: "ACTIVE" }
        : { id: user.teacherId ?? "", status: "ACTIVE" },
      include: { department: true },
      orderBy: { code: "asc" }
    }),
    selectedTeacherId
      ? prisma.teachingSchedule.findMany({
          where: { teacherId: selectedTeacherId, dayOfWeek },
          include: { classRoom: true, subject: true, specialRoom: true },
          orderBy: { period: "asc" }
        })
      : [],
    prisma.teacherAbsence.findMany({
      where: canManageAllAbsences ? {} : { teacherId: user.teacherId ?? "" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { teacher: true, periods: { include: { schedule: { include: { subject: true } } } } }
    })
  ]);

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>บันทึกครูลา/ไปราชการ</h1>
          <p className="muted">
            {canManageAllAbsences ? "เลือกครูและวันที่เพื่อดูคาบที่ต้องจัดการ" : "ครูบันทึกไปราชการ/ลากิจของตนเองเพื่อดำเนินการแลกคาบได้"}
          </p>
        </div>
      </div>
      <section className="grid">
        <div className="card span-4">
          <h2>ค้นหาคาบสอน</h2>
          <form className="form" method="get">
            <label>
              วันที่
              <input name="date" type="date" defaultValue={selectedDate} />
            </label>
            <label>
              ครู
              <select name="teacherId" defaultValue={selectedTeacherId} required disabled={!canManageAllAbsences}>
                {canManageAllAbsences ? <option value="">เลือกครู</option> : null}
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.code} - {teacher.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn" type="submit">
              แสดงคาบสอน
            </button>
          </form>
        </div>

        <div className="card span-8">
          <h2>คาบสอนวันที่ {formatThaiDate(date)} ({thaiDays[dayOfWeek]})</h2>
          {!selectedTeacherId ? (
            <p className="muted">กรุณาเลือกครูก่อน</p>
          ) : schedules.length === 0 ? (
            <p className="muted">ไม่พบคาบสอนในวันนี้</p>
          ) : (
            <form className="form" action="/api/absences" method="post">
              <input type="hidden" name="teacherId" value={selectedTeacherId} />
              <input type="hidden" name="date" value={selectedDate} />
              <div className="form-row">
                {canManageAllAbsences ? (
                  <label>
                    ประเภท
                  <select name="type">
                    <option value="LEAVE">ลา</option>
                    <option value="PERSONAL">ลากิจ</option>
                    <option value="OFFICIAL">ไปราชการ</option>
                  </select>
                </label>
              ) : (
                <label>
                  ประเภท
                    <select name="type" defaultValue="OFFICIAL">
                      <option value="OFFICIAL">ไปราชการ</option>
                      <option value="PERSONAL">ลากิจ</option>
                    </select>
                </label>
              )}
                <label>
                  หมายเหตุ
                  <input name="note" placeholder="ถ้ามี" />
                </label>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>เลือก</th>
                      <th>คาบ</th>
                      <th>ห้อง</th>
                      <th>วิชา</th>
                      <th>ห้องพิเศษ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((schedule) => (
                      <tr key={schedule.id}>
                        <td>
                          <input type="checkbox" name="scheduleIds" value={schedule.id} />
                        </td>
                        <td>{schedule.period}</td>
                        <td>{schedule.classRoom.name}</td>
                        <td>{schedule.subject.name}</td>
                        <td>{schedule.specialRoom?.name ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn primary" type="submit">
                บันทึกและสร้างรายการจัดการ
              </button>
            </form>
          )}
        </div>

        <div className="card">
          <h2>รายการล่าสุด</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ครู</th>
                  <th>ประเภท</th>
                  <th>คาบ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {absences.map((absence) => (
                  <tr key={absence.id}>
                    <td>{formatThaiDate(absence.date)}</td>
                    <td>{absence.teacher.name}</td>
                    <td>{absenceTypeLabel(absence.type)}</td>
                    <td>{absence.periods.map((period) => period.period).join(", ")}</td>
                    <td>
                      <div className="actions">
                        {absence.periods.map((period) => (
                          <Link
                            className="btn"
                            key={period.id}
                            href={
                              absence.type === "OFFICIAL" || absence.type === "PERSONAL"
                                ? `/swaps?absencePeriodId=${period.id}`
                                : `/substitutions?absencePeriodId=${period.id}`
                            }
                          >
                            คาบ {period.period}
                          </Link>
                        ))}
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

function absenceTypeLabel(type: string) {
  if (type === "OFFICIAL") return "ไปราชการ";
  if (type === "PERSONAL") return "ลากิจ";
  return "ลา";
}
