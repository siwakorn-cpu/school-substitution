import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { canApproveSwap, canManageSwap } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatThaiDate, thaiDays } from "@/lib/date";
import { recommendSubstitutes } from "@/lib/recommendSubstitutes";
import { getSwapCandidates } from "@/lib/swapCandidates";

export default async function SwapsPage({
  searchParams
}: {
  searchParams: Promise<{ absencePeriodId?: string }>;
}) {
  const user = await requireUser();
  if (!(await canManageSwap(user))) {
    return (
      <AppShell user={user}>
        <p className="error">บัญชีนี้ไม่มีสิทธิ์จัดการแลกคาบ</p>
      </AppShell>
    );
  }
  const params = await searchParams;
  const absencePeriodId = params.absencePeriodId ?? "";
  const isTeacherScoped = user.role === "TEACHER";
  const canApproveScheduleChange = await canApproveSwap(user);

  const [periods, requests, subjects] = await Promise.all([
    prisma.absencePeriod.findMany({
      where: {
        absence: {
          type: { in: ["OFFICIAL", "PERSONAL"] },
          ...(isTeacherScoped ? { teacherId: user.teacherId ?? "" } : {})
        }
      },
      include: {
        absence: { include: { teacher: true } },
        schedule: { include: { classRoom: true, subject: true } }
      },
      orderBy: [{ absence: { date: "desc" } }, { period: "asc" }]
    }),
    prisma.swapRequest.findMany({
      where: isTeacherScoped
        ? {
            OR: [{ requesterTeacherId: user.teacherId ?? "" }, { targetTeacherId: user.teacherId ?? "" }]
          }
        : {},
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        requesterTeacher: true,
        targetTeacher: true
      }
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" } })
  ]);

  const selected = absencePeriodId
    ? await prisma.absencePeriod.findUnique({
        where: { id: absencePeriodId },
        include: {
          absence: { include: { teacher: true } },
          schedule: { include: { teacher: true, classRoom: true, subject: true, specialRoom: true } },
          substitution: true
        }
      })
    : null;
  const [swapCandidates, substituteCandidates] = selected
    ? await Promise.all([getSwapCandidates(selected.id), recommendSubstitutes(selected.id)])
    : [[], []];

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>จัดการการเปลี่ยนแปลงคาบสอน</h1>
          <p className="muted">แยกการเข้าแทนออกจากการสลับคาบ เพื่อให้ตรวจเงื่อนไขถูกต้องตามความหมายของแต่ละกรณี</p>
        </div>
      </div>

      <section className="grid">
        <div className="card">
          <h2>คาบไปราชการ/ลากิจ</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ครู</th>
                  <th>คาบ</th>
                  <th>ห้อง</th>
                  <th>วิชา</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.id}>
                    <td>{formatThaiDate(period.absence.date)}</td>
                    <td>{period.absence.teacher.name}</td>
                    <td>{period.period}</td>
                    <td>{period.schedule.classRoom.name}</td>
                    <td>{period.schedule.subject.name}</td>
                    <td>
                      <a className="btn" href={`/swaps?absencePeriodId=${period.id}`}>
                        เลือกคาบ
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          {!selected ? (
            <p className="muted">เลือกคาบไปราชการ/ลากิจเพื่อจัดการเข้าแทนหรือสลับคาบ</p>
          ) : (
            <>
              <h2>คาบต้นทาง</h2>
              <p>
                {selected.absence.teacher.name} · {formatThaiDate(selected.absence.date)} · คาบ {selected.period} ·{" "}
                {selected.schedule.classRoom.name} · {selected.schedule.subject.name}
              </p>
              <div className="change-type-grid">
                <section>
                  <h3>ประเภทที่ 1: เข้าแทน</h3>
                  <p className="muted">
                    ใช้วันเดิม คาบเดิม ห้องเดิม และรายวิชาเดิม เปลี่ยนเฉพาะครูผู้สอน โดยครูเข้าแทนต้องว่างในคาบนี้
                  </p>
                  {canApproveScheduleChange ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>ครูเข้าแทน</th>
                            <th>กลุ่มสาระ</th>
                            <th>คะแนน</th>
                            <th>เหตุผล</th>
                            <th>บันทึกเข้าแทน</th>
                          </tr>
                        </thead>
                        <tbody>
                          {substituteCandidates.map((item) => (
                            <tr key={item.teacherId}>
                              <td>{item.teacherName}</td>
                              <td>{item.departmentName}</td>
                              <td>{item.score}</td>
                              <td>
                                {[...item.reasons, ...item.warnings].join(", ")}
                                <br />
                                <span className="muted">
                                  ผลลัพธ์: {formatThaiDate(selected.absence.date)} คาบ {selected.period}{" "}
                                  {selected.schedule.classRoom.name} {selected.schedule.subject.name} ครู {item.teacherName}
                                </span>
                              </td>
                              <td>
                                <form className="form" action="/api/swaps" method="post">
                                  <input type="hidden" name="intent" value="substitute" />
                                  <input type="hidden" name="absencePeriodId" value={selected.id} />
                                  <input type="hidden" name="substituteTeacherId" value={item.teacherId} />
                                  <select name="subjectId" defaultValue={selected.schedule.subjectId} aria-label="รายวิชา">
                                    {subjects.map((subject) => (
                                      <option key={subject.id} value={subject.id}>
                                        {subject.name}
                                      </option>
                                    ))}
                                  </select>
                                  <input name="reason" placeholder="เหตุผล/หมายเหตุ" defaultValue={selected.absence.note ?? ""} />
                                  <button className="btn primary" type="submit">
                                    ยืนยันเข้าแทน
                                  </button>
                                </form>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted">การบันทึกเข้าแทนต้องให้ผู้ดูแลหรือหัวหน้าที่มีสิทธิ์อนุมัติเป็นผู้ดำเนินการ</p>
                  )}
                </section>

                <section>
                  <h3>ประเภทที่ 2: สลับคาบ</h3>
                  <p className="muted">
                    สลับได้เฉพาะคาบของห้องเรียน/กลุ่มห้องเดียวกันเท่านั้น ระบบตรวจครูไม่สอนซ้อน ห้องเรียนไม่ซ้อน และห้อง/อาคารไม่ชน
                  </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>คาบปลายทาง</th>
                      <th>ครู</th>
                      <th>ห้อง/วิชาเดิม</th>
                      <th>Preview หลังสลับ</th>
                      <th>คำเตือน</th>
                      <th>สร้างคำขอ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {swapCandidates.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {thaiDays[item.dayOfWeek]} คาบ {item.period}
                        </td>
                        <td>{item.teacher.name}</td>
                        <td>
                          {item.classRoom.name} · {item.subject.name}
                          {item.specialRoom ? ` · ${item.specialRoom.name}` : ""}
                        </td>
                        <td>
                          <strong>ต้นทาง:</strong> {thaiDays[selected.schedule.dayOfWeek]} คาบ {selected.schedule.period}{" "}
                          {item.subject.name} ครู {item.teacher.name}
                          {item.specialRoom ? ` · ${item.specialRoom.name}` : ""}
                          <br />
                          <strong>ปลายทาง:</strong> {thaiDays[item.dayOfWeek]} คาบ {item.period}{" "}
                          {selected.schedule.subject.name} ครู {selected.schedule.teacher.name}
                          {selected.schedule.specialRoom ? ` · ${selected.schedule.specialRoom.name}` : ""}
                        </td>
                        <td>
                          {item.splitDoublePeriod ? <span className="badge warning">แตกคาบคู่</span> : null}
                          {item.warnings.length > 0 ? (
                            <ul className="compact-list">
                              {item.warnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="muted">ผ่านเงื่อนไข</span>
                          )}
                        </td>
                        <td>
                          <form className="form" action="/api/swaps" method="post">
                            <input type="hidden" name="intent" value="create" />
                            <input type="hidden" name="absencePeriodId" value={selected.id} />
                            <input type="hidden" name="toScheduleId" value={item.id} />
                            <input name="reason" placeholder="เหตุผล/หมายเหตุ" defaultValue={selected.absence.note ?? ""} />
                            <button className="btn primary" type="submit">
                              ยืนยันส่งคำขอสลับ
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                </section>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <h2>รายการแลกคาบ</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ครูต้นทาง</th>
                  <th>ครูปลายทาง</th>
                  <th>สถานะ</th>
                  <th>หมายเหตุ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>{formatThaiDate(request.date)}</td>
                    <td>{request.requesterTeacher.name}</td>
                    <td>{request.targetTeacher.name}</td>
                    <td>
                      <span className={`badge ${request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "danger" : "warning"}`}>
                        {request.status === "APPROVED" ? "อนุมัติ" : request.status === "REJECTED" ? "ไม่อนุมัติ" : "รออนุมัติ"}
                      </span>
                      {request.splitDoublePeriod ? <span className="badge warning">แตกคาบคู่</span> : null}
                    </td>
                    <td>{request.note || "-"}</td>
                    <td>
                      {request.status === "PENDING" && (canApproveScheduleChange || user.teacherId === request.targetTeacherId) ? (
                        <div className="actions">
                          <form action="/api/swaps" method="post">
                            <input type="hidden" name="intent" value="approve" />
                            <input type="hidden" name="id" value={request.id} />
                            <button className="btn primary" type="submit">
                              อนุมัติ
                            </button>
                          </form>
                          <form action="/api/swaps" method="post">
                            <input type="hidden" name="intent" value="reject" />
                            <input type="hidden" name="id" value={request.id} />
                            <button className="btn danger" type="submit">
                              ไม่อนุมัติ
                            </button>
                          </form>
                        </div>
                      ) : (
                        "-"
                      )}
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
