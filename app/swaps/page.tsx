import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { canApproveSwap, canManageSwap } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatThaiDate, nextDateForDayOfWeek, parseDateInput, thaiDays, toDateInputValue } from "@/lib/date";
import { recommendSubstitutes } from "@/lib/recommendSubstitutes";
import { getSwapCandidates } from "@/lib/swapCandidates";

export default async function SwapsPage({
  searchParams
}: {
  searchParams: Promise<{ absencePeriodId?: string; edit?: string }>;
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
  const isEditing = params.edit === "1";
  const isTeacherScoped = user.role === "TEACHER";
  const canApproveScheduleChange = await canApproveSwap(user);

  const substitutionWhere: Prisma.SubstitutionWhereInput = {
    absencePeriod: { absence: { type: { in: ["OFFICIAL", "PERSONAL"] } } }
  };
  if (isTeacherScoped) {
    substitutionWhere.OR = [
      { substituteTeacherId: user.teacherId ?? "" },
      { absencePeriod: { absence: { teacherId: user.teacherId ?? "" } } }
    ];
  }

  const [periods, requests, substitutionRecords, subjects] = await Promise.all([
    prisma.absencePeriod.findMany({
      where: {
        absence: {
          type: { in: ["OFFICIAL", "PERSONAL"] },
          ...(isTeacherScoped ? { teacherId: user.teacherId ?? "" } : {})
        },
        // Hide periods already handled: an entered substitute, or an active swap (pending/approved).
        substitution: null,
        swapRequests: { none: { status: { in: ["PENDING", "APPROVED"] } } }
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
    prisma.substitution.findMany({
      where: substitutionWhere,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        absencePeriod: {
          include: {
            absence: { include: { teacher: true } },
            schedule: { include: { classRoom: true, subject: true } }
          }
        }
      }
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" } })
  ]);

  const substituteTeachers = await prisma.teacher.findMany({
    where: { id: { in: substitutionRecords.map((item) => item.substituteTeacherId) } }
  });
  const substituteTeacherMap = new Map(substituteTeachers.map((teacher) => [teacher.id, teacher]));

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
  const existingSwapRequest = selected
    ? await prisma.swapRequest.findFirst({
        where: { absencePeriodId: selected.id, status: { not: "REJECTED" } },
        orderBy: { createdAt: "desc" },
        include: { requesterTeacher: true, targetTeacher: true }
      })
    : null;
  const [swapCandidates, substituteCandidates] = selected
    ? await Promise.all([getSwapCandidates(selected.id), recommendSubstitutes(selected.id)])
    : [[], []];

  const hasResolution = Boolean(selected?.substitution || existingSwapRequest);
  const canEditResolution =
    canApproveScheduleChange && (existingSwapRequest?.status !== "APPROVED" || user.role === "ADMIN");
  const canCancelSubstitution = canApproveScheduleChange;
  const canCancelSwap =
    existingSwapRequest?.status === "PENDING" &&
    (canApproveScheduleChange || (Boolean(user.teacherId) && existingSwapRequest.requesterTeacher.id === user.teacherId));
  const today = parseDateInput(toDateInputValue());
  const selectedIsPast = selected ? selected.absence.date < today : false;
  const canActOnSelected = !selectedIsPast || user.role === "ADMIN";
  const showCandidates = (!selected || isEditing || !hasResolution) && canActOnSelected;

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
                    <td className="no-glossary">{period.absence.teacher.name}</td>
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
              <h2>สลับคาบ/ขอให้เข้าสอนแทน</h2>
              <p>
                <span className="no-glossary">{selected.absence.teacher.name}</span> · {formatThaiDate(selected.absence.date)} ·
                คาบ {selected.period} · {selected.schedule.classRoom.name} · {selected.schedule.subject.name}
              </p>

              {hasResolution && !isEditing ? (
                <div className="recommendation-list">
                  <div className="recommendation-item">
                    <div className="recommendation-main">
                      {selected.substitution ? (
                        <>
                          <strong>เข้าแทนแล้ว</strong>
                          <p className="muted">
                            ครูเข้าแทน:{" "}
                            <span className="no-glossary">
                              {substituteTeacherMap.get(selected.substitution.substituteTeacherId)?.name ??
                                "ไม่พบข้อมูลครู"}
                            </span>
                          </p>
                        </>
                      ) : existingSwapRequest ? (
                        <>
                          <strong>ส่งคำขอสลับคาบแล้ว</strong>
                          <p className="muted">
                            ครูปลายทาง: <span className="no-glossary">{existingSwapRequest.targetTeacher.name}</span>
                          </p>
                          <span
                            className={`badge ${
                              existingSwapRequest.status === "APPROVED"
                                ? "success"
                                : "warning"
                            }`}
                          >
                            {existingSwapRequest.status === "APPROVED" ? "อนุมัติแล้ว" : "รออนุมัติ"}
                          </span>
                        </>
                      ) : null}
                    </div>
                    <div className="actions">
                      {canEditResolution ? (
                        <a className="btn primary" href={`/swaps?absencePeriodId=${selected.id}&edit=1`}>
                          แก้ไข
                        </a>
                      ) : null}
                      {selected.substitution && canCancelSubstitution ? (
                        <form action="/api/swaps" method="post">
                          <input type="hidden" name="intent" value="cancel_substitute" />
                          <input type="hidden" name="absencePeriodId" value={selected.id} />
                          <button className="btn danger" type="submit">
                            ยกเลิก
                          </button>
                        </form>
                      ) : null}
                      {existingSwapRequest && canCancelSwap ? (
                        <form action="/api/swaps" method="post">
                          <input type="hidden" name="intent" value="cancel_swap" />
                          <input type="hidden" name="absencePeriodId" value={selected.id} />
                          <input type="hidden" name="id" value={existingSwapRequest.id} />
                          <button className="btn danger" type="submit">
                            ยกเลิก
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {selected && !canActOnSelected && !hasResolution ? (
                <p className="badge warning">คาบย้อนหลัง — ดำเนินการได้เฉพาะผู้ดูแลระบบ</p>
              ) : null}

              {showCandidates ? (
                <div className="change-type-grid">
                  {isEditing ? (
                    <div className="actions">
                      <span className="badge warning">กำลังแก้ไข</span>
                      <a className="btn" href={`/swaps?absencePeriodId=${selected.id}`}>
                        ยกเลิกการแก้ไข
                      </a>
                    </div>
                  ) : null}
                  <section>
                    <h3>ประเภทที่ 1: สลับคาบ</h3>
                    <p className="muted">
                      สลับได้เฉพาะคาบของห้องเรียน/กลุ่มห้องเดียวกันเท่านั้น ระบบตรวจครูไม่สอนซ้อน ห้องเรียนไม่ซ้อน และห้อง/อาคารไม่ชน
                    </p>
                    <div className="table-wrap">
                      <table className="swap-table">
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
                              <td className="no-glossary">{item.teacher.name}</td>
                              <td>
                                {item.classRoom.name} · {item.subject.name}
                                {item.specialRoom ? ` · ${item.specialRoom.name}` : ""}
                              </td>
                              <td>
                                <strong>ต้นทาง:</strong> {thaiDays[selected.schedule.dayOfWeek]} คาบ{" "}
                                {selected.schedule.period} {item.subject.name} ครู{" "}
                                <span className="no-glossary">{item.teacher.name}</span>
                                {item.specialRoom ? ` · ${item.specialRoom.name}` : ""}
                                <br />
                                <strong>ปลายทาง:</strong> {thaiDays[item.dayOfWeek]} คาบ {item.period}{" "}
                                {selected.schedule.subject.name} ครู{" "}
                                <span className="no-glossary">{selected.schedule.teacher.name}</span>
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
                                  <label className="swap-date-field">
                                    วันที่สลับ (สัปดาห์ของคาบปลายทาง)
                                    <input
                                      type="date"
                                      name="toDate"
                                      defaultValue={
                                        existingSwapRequest?.toScheduleId === item.id && existingSwapRequest.toDate
                                          ? toDateInputValue(existingSwapRequest.toDate)
                                          : toDateInputValue(nextDateForDayOfWeek(selected.absence.date, item.dayOfWeek))
                                      }
                                    />
                                  </label>
                                  <input
                                    name="reason"
                                    placeholder="เหตุผล/หมายเหตุ"
                                    defaultValue={existingSwapRequest?.note ?? selected.absence.note ?? ""}
                                  />
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

                  <section>
                    <h3>ประเภทที่ 2: เข้าแทน</h3>
                    <p className="muted">
                      ใช้วันเดิม คาบเดิม ห้องเดิม และรายวิชาเดิม เปลี่ยนเฉพาะครูผู้สอน โดยครูเข้าแทนต้องว่างในคาบนี้
                    </p>
                    {canApproveScheduleChange ? (
                      <div className="table-wrap">
                        <table className="swap-table">
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
                                <td className="no-glossary">{item.teacherName}</td>
                                <td>{item.departmentName}</td>
                                <td>{item.score}</td>
                                <td>
                                  {[...item.reasons, ...item.warnings].join(", ")}
                                  <br />
                                  <span className="muted">
                                    ผลลัพธ์: {formatThaiDate(selected.absence.date)} คาบ {selected.period}{" "}
                                    {selected.schedule.classRoom.name} {selected.schedule.subject.name} ครู{" "}
                                    <span className="no-glossary">{item.teacherName}</span>
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
                                    <input
                                      name="reason"
                                      placeholder="เหตุผล/หมายเหตุ"
                                      defaultValue={selected.substitution?.note ?? selected.absence.note ?? ""}
                                    />
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
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="card">
          <h2>รายการแลกคาบ (สลับคาบ)</h2>
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
                    <td className="no-glossary">{request.requesterTeacher.name}</td>
                    <td className="no-glossary">{request.targetTeacher.name}</td>
                    <td>
                      <span className={`badge ${request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "danger" : "warning"}`}>
                        {request.status === "APPROVED" ? "อนุมัติ" : request.status === "REJECTED" ? "ไม่อนุมัติ" : "รออนุมัติ"}
                      </span>
                      {request.splitDoublePeriod ? <span className="badge warning">แตกคาบคู่</span> : null}
                    </td>
                    <td>{request.note || "-"}</td>
                    <td>
                      {canApproveScheduleChange || user.teacherId === request.targetTeacherId ? (
                        <div className="actions">
                          {request.status !== "APPROVED" ? (
                            <form action="/api/swaps" method="post">
                              <input type="hidden" name="intent" value="approve" />
                              <input type="hidden" name="id" value={request.id} />
                              <button className="btn primary" type="submit">
                                อนุมัติ
                              </button>
                            </form>
                          ) : null}
                          {request.status !== "REJECTED" ? (
                            <form action="/api/swaps" method="post">
                              <input type="hidden" name="intent" value="reject" />
                              <input type="hidden" name="id" value={request.id} />
                              <button className="btn danger" type="submit">
                                ไม่อนุมัติ
                              </button>
                            </form>
                          ) : null}
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

        <div className="card">
          <h2>รายการเข้าแทน</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ครูต้นทาง</th>
                  <th>ครูเข้าแทน</th>
                  <th>คาบ/วิชา</th>
                  <th>หมายเหตุ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {substitutionRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{formatThaiDate(record.date)}</td>
                    <td className="no-glossary">{record.absencePeriod.absence.teacher.name}</td>
                    <td className="no-glossary">
                      {substituteTeacherMap.get(record.substituteTeacherId)?.name ?? "ไม่พบข้อมูลครู"}
                    </td>
                    <td>
                      คาบ {record.period} · {record.absencePeriod.schedule.classRoom.name} ·{" "}
                      {record.absencePeriod.schedule.subject.name}
                    </td>
                    <td>{record.note || "-"}</td>
                    <td>
                      {canApproveScheduleChange ? (
                        <div className="actions">
                          <a className="btn" href={`/swaps?absencePeriodId=${record.absencePeriodId}&edit=1`}>
                            แก้ไข
                          </a>
                          <form action="/api/swaps" method="post">
                            <input type="hidden" name="intent" value="cancel_substitute" />
                            <input type="hidden" name="absencePeriodId" value={record.absencePeriodId} />
                            <button className="btn danger" type="submit">
                              ยกเลิก
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
