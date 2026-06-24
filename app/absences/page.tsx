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
  const [canManageAllAbsences, canRecordOwn] = await Promise.all([
    canManageAbsence(user),
    canRecordOwnAbsence(user)
  ]);
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

  const [teachers, schedules, absences, leaveRequests] = await Promise.all([
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
      include: {
        teacher: true,
        periods: {
          include: { schedule: { include: { subject: true } }, substitution: true, swapRequests: true }
        }
      }
    }),
    prisma.teacherAbsence.findMany({
      where: {
        type: { in: ["PERSONAL", "OFFICIAL"] },
        ...(canManageAllAbsences ? {} : { teacherId: user.teacherId ?? "" })
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 12,
      include: { teacher: { include: { department: true } }, periods: true }
    })
  ]);

  return (
    <AppShell user={user}>
      <div className="compact-page">
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

        {canManageAllAbsences ? (
          <div className="card span-4">
            <h2>บันทึกลาป่วย/ลากิจหลายคน</h2>
            <form className="form" action="/api/absences" method="post">
              <input type="hidden" name="intent" value="bulk" />
              <label>
                วันที่
                <input name="date" type="date" defaultValue={selectedDate} />
              </label>
              <label>
                ประเภท
                <select name="type" defaultValue="LEAVE">
                  <option value="LEAVE">ลาป่วย</option>
                  <option value="PERSONAL">ลากิจ</option>
                </select>
              </label>
              <label>
                หมายเหตุ
                <input name="note" placeholder="ถ้ามี" />
              </label>
              <div className="checkbox-grid" aria-label="เลือกครู">
                {teachers.map((teacher) => (
                  <label className="compact-check" key={teacher.id}>
                    <input type="checkbox" name="teacherIds" value={teacher.id} />
                    <span>
                      <span className="no-glossary">
                        {teacher.code} - {teacher.name}
                      </span>
                      <small>{teacher.department.name}</small>
                    </span>
                  </label>
                ))}
              </div>
              <button className="btn primary" type="submit">
                บันทึกหลายคน
              </button>
            </form>
          </div>
        ) : null}

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
                    <option value="LEAVE">ลาป่วย</option>
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
                      <th>ห้อง/อาคาร</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((schedule) => (
                      <tr key={schedule.id}>
                        <td>
                          <input
                            type="checkbox"
                            name="scheduleIds"
                            value={schedule.id}
                            disabled={!schedule.subject.requiresSubstitution}
                          />
                        </td>
                        <td>{schedule.period}</td>
                        <td>{schedule.classRoom.name}</td>
                        <td>
                          {schedule.subject.name}
                          {!schedule.subject.requiresSubstitution ? <span className="badge warning">ไม่ต้องจัดสอนแทน</span> : null}
                        </td>
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
                  <th>แก้ไข/ยกเลิก</th>
                </tr>
              </thead>
              <tbody>
                {absences.map((absence) => (
                  <tr key={absence.id}>
                    <td>{formatThaiDate(absence.date)}</td>
                    <td className="no-glossary">{absence.teacher.name}</td>
                    <td>{absenceTypeLabel(absence.type)}</td>
                    <td>{absence.periods.map((period) => period.period).join(", ")}</td>
                    <td>
                      <div className="actions">
                        {absence.periods.map((period) => (
                          <Link
                            className={`btn ${periodStatusClass(period)}`}
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
                    <td>
                      <div className="actions">
                        <details className="absence-edit-toggle">
                          <summary>แก้ไข</summary>
                          <form className="absence-edit-form" action="/api/absences" method="post">
                            <input type="hidden" name="intent" value="update" />
                            <input type="hidden" name="absenceId" value={absence.id} />
                            <label>
                              ประเภท
                              <select name="type" defaultValue={absence.type}>
                                {canManageAllAbsences ? <option value="LEAVE">ลาป่วย</option> : null}
                                <option value="PERSONAL">ลากิจ</option>
                                <option value="OFFICIAL">ไปราชการ</option>
                              </select>
                            </label>
                            <label>
                              หมายเหตุ
                              <input name="note" defaultValue={absence.note ?? ""} placeholder="ถ้ามี" />
                            </label>
                            <button className="btn primary" type="submit">
                              บันทึก
                            </button>
                          </form>
                        </details>
                        <form action="/api/absences" method="post">
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="absenceId" value={absence.id} />
                          <button className="btn danger" type="submit">
                            ยกเลิก
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>การยื่นลากิจหรือไปราชการ</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ครู</th>
                  <th>กลุ่มสาระ</th>
                  <th>ประเภท</th>
                  <th>คาบที่เกี่ยวข้อง</th>
                  <th>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{formatThaiDate(request.date)}</td>
                    <td className="no-glossary">{request.teacher.name}</td>
                    <td>{request.teacher.department.name}</td>
                    <td>{absenceTypeLabel(request.type)}</td>
                    <td>{request.periods.map((period) => period.period).join(", ") || "-"}</td>
                    <td>{request.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      </div>
    </AppShell>
  );
}

function absenceTypeLabel(type: string) {
  if (type === "OFFICIAL") return "ไปราชการ";
  if (type === "PERSONAL") return "ลากิจ";
  return "ลาป่วย";
}

// Status colour of a period button: green = handled, yellow = pending approval, red = not handled yet.
function periodStatusClass(period: {
  substitution: { status: string } | null;
  swapRequests: { status: string }[];
}) {
  if (period.substitution?.status === "APPROVED") return "period-status-done";
  if (period.substitution?.status === "PENDING") return "period-status-pending";
  if (period.swapRequests.some((swap) => swap.status === "APPROVED")) return "period-status-done";
  if (period.swapRequests.some((swap) => swap.status === "PENDING")) return "period-status-pending";
  return "period-status-none";
}
