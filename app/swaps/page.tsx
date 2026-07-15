import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { ExportTablePng } from "@/components/ExportTablePng";
import { requireUser } from "@/lib/auth";
import { canApproveSwap, canManageSwap } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatThaiDate, nextDateForDayOfWeek, parseDateInput, thaiDays, toDateInputValue } from "@/lib/date";
import { recommendSubstitutes } from "@/lib/recommendSubstitutes";
import { getSwapCandidates } from "@/lib/swapCandidates";
import { TableTeacherSearch } from "@/components/TableTeacherSearch";
import { TeacherHoverSchedule, hoverWeekDays } from "@/components/TeacherHoverSchedule";

export default async function SwapsPage({
  searchParams
}: {
  searchParams: Promise<{ absencePeriodId?: string; edit?: string; viewDate?: string }>;
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

  const selectedViewDate = params.viewDate ?? toDateInputValue();
  const viewDateStart = parseDateInput(selectedViewDate);
  const viewDateEnd = new Date(viewDateStart);
  viewDateEnd.setDate(viewDateEnd.getDate() + 1);
  const todayHref = `/swaps${absencePeriodId ? `?absencePeriodId=${absencePeriodId}${isEditing ? "&edit=1" : ""}` : ""}`;

  const substitutionWhere: Prisma.SubstitutionWhereInput = {
    absencePeriod: { absence: { type: { in: ["OFFICIAL", "PERSONAL", "LEAVE"] } } },
    date: { gte: viewDateStart, lt: viewDateEnd }
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
          // ลาป่วย (LEAVE) แลกคาบได้ด้วย สำหรับกลุ่มสาระที่หาครูสอนแทนยาก
          type: { in: ["OFFICIAL", "PERSONAL", "LEAVE"] },
          ...(isTeacherScoped ? { teacherId: user.teacherId ?? "" } : {})
        },
        // Hide periods already handled: an active substitute (pending/approved), or an active swap (pending/approved).
        OR: [{ substitution: null }, { substitution: { status: "REJECTED" } }],
        swapRequests: { none: { status: { in: ["PENDING", "APPROVED"] } } },
        // Hide periods closed without needing anyone (e.g. field trips marked on the substitutions page).
        NOT: { status: "DONE", actionType: "NONE" }
      },
      include: {
        absence: { include: { teacher: true } },
        schedule: { include: { classRoom: true, subject: true } }
      },
      orderBy: [{ absence: { date: "desc" } }, { period: "asc" }]
    }),
    prisma.swapRequest.findMany({
      where: {
        date: { gte: viewDateStart, lt: viewDateEnd },
        ...(isTeacherScoped
          ? { OR: [{ requesterTeacherId: user.teacherId ?? "" }, { targetTeacherId: user.teacherId ?? "" }] }
          : {})
      },
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
            schedule: { include: { classRoom: true, subject: true, specialRoom: true } }
          }
        }
      }
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" } })
  ]);

  const swapScheduleIds = Array.from(new Set(requests.flatMap((request) => [request.fromScheduleId, request.toScheduleId])));
  const swapSchedules = await prisma.teachingSchedule.findMany({
    where: { id: { in: swapScheduleIds } },
    include: { classRoom: true, subject: true, specialRoom: true }
  });
  const swapScheduleMap = new Map(swapSchedules.map((schedule) => [schedule.id, schedule]));

  const swapTableRows = requests
    .map((request) => {
      const fromSchedule = swapScheduleMap.get(request.fromScheduleId);
      const toSchedule = swapScheduleMap.get(request.toScheduleId);
      if (!fromSchedule || !toSchedule) return null;
      const toDate = request.toDate ?? nextDateForDayOfWeek(request.date, toSchedule.dayOfWeek);
      const statusLabel =
        request.status === "APPROVED" ? "อนุมัติแล้ว" : request.status === "REJECTED" ? "ไม่อนุมัติ" : "รออนุมัติ";
      return {
        id: request.id,
        request,
        classRoomName: fromSchedule.classRoom.name,
        period: fromSchedule.period,
        subjectCode: fromSchedule.subject.code ?? "-",
        subjectName: fromSchedule.subject.name,
        specialRoomName: fromSchedule.specialRoom?.name ?? "-",
        toDate,
        toPeriod: toSchedule.period,
        toSubjectCode: toSchedule.subject.code ?? "-",
        toSubjectName: toSchedule.subject.name,
        toSpecialRoomName: toSchedule.specialRoom?.name ?? "-",
        statusLabel
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const swapExportColumns = [
    "วันที่ลาหรือราชการ",
    "ชั้น ม.",
    "คาบ",
    "รหัสวิชา",
    "ชื่อรายวิชา",
    "ห้อง/อาคาร",
    "วันที่แลกคาบ/สลับคาบ",
    "คาบเรียนที่สลับคาบ",
    "รหัสวิชาที่สลับคาบ",
    "ชื่อรายวิชาที่สลับคาบ",
    "ห้อง/อาคารที่สลับคาบ",
    "ครูที่รับแลกคาบ",
    "การอนุมัติ"
  ];
  const swapExportRows = swapTableRows.map((row) => [
    formatThaiDate(row.request.date),
    row.classRoomName,
    String(row.period),
    row.subjectCode,
    row.subjectName,
    row.specialRoomName,
    formatThaiDate(row.toDate),
    String(row.toPeriod),
    row.toSubjectCode,
    row.toSubjectName,
    row.toSpecialRoomName,
    row.request.targetTeacher.name,
    row.statusLabel
  ]);

  const substituteTeachers = await prisma.teacher.findMany({
    where: {
      id: {
        in: substitutionRecords
          .map((item) => item.substituteTeacherId)
          .filter((teacherId): teacherId is string => Boolean(teacherId))
      }
    }
  });
  const substituteTeacherMap = new Map(substituteTeachers.map((teacher) => [teacher.id, teacher]));

  const substitutionSubjectIds = Array.from(new Set(substitutionRecords.map((record) => record.subjectId)));
  const substitutionSpecialRoomIds = Array.from(
    new Set(substitutionRecords.map((record) => record.specialRoomId).filter((id): id is string => Boolean(id)))
  );
  const [substitutionSubjects, substitutionSpecialRooms] = await Promise.all([
    prisma.subject.findMany({ where: { id: { in: substitutionSubjectIds } } }),
    prisma.room.findMany({ where: { id: { in: substitutionSpecialRoomIds } } })
  ]);
  const substitutionSubjectMap = new Map(substitutionSubjects.map((subject) => [subject.id, subject]));
  const substitutionSpecialRoomMap = new Map(substitutionSpecialRooms.map((room) => [room.id, room]));

  const substitutionTableRows = substitutionRecords.map((record) => {
    const originalSubject = record.absencePeriod.schedule.subject;
    const originalSpecialRoom = record.absencePeriod.schedule.specialRoom;
    const substituteSubject = substitutionSubjectMap.get(record.subjectId);
    const substituteSpecialRoom = record.specialRoomId ? substitutionSpecialRoomMap.get(record.specialRoomId) : null;
    const statusLabel =
      record.status === "APPROVED" ? "อนุมัติแล้ว" : record.status === "REJECTED" ? "ไม่อนุมัติ" : "รออนุมัติจากครูเข้าแทน";
    return {
      id: record.id,
      record,
      classRoomName: record.absencePeriod.schedule.classRoom.name,
      originalSubjectCode: originalSubject.code ?? "-",
      originalSubjectName: originalSubject.name,
      originalSpecialRoomName: originalSpecialRoom?.name ?? "-",
      substituteSubjectCode: substituteSubject?.code ?? "-",
      substituteSubjectName: substituteSubject?.name ?? "-",
      substituteSpecialRoomName: substituteSpecialRoom?.name ?? "-",
      substituteTeacherName: record.externalSubstituteName
        ? `นิสิต/นักศึกษาฝึกประสบการณ์: ${record.externalSubstituteName}`
        : substituteTeacherMap.get(record.substituteTeacherId ?? "")?.name ?? "ไม่พบข้อมูลครู",
      statusLabel
    };
  });

  const substitutionExportColumns = [
    "วันที่ลาหรือราชการ",
    "ชั้น ม.",
    "คาบ",
    "รหัสวิชาเดิม",
    "ชื่อรายวิชาเดิม",
    "ห้อง/อาคารเดิม",
    "รหัสวิชาที่สอนแทน",
    "ชื่อรายวิชาที่สอนแทน",
    "ห้อง/อาคารที่สอนแทน",
    "ครูต้นทาง",
    "ครูเข้าแทน",
    "การอนุมัติ"
  ];
  const substitutionExportRows = substitutionTableRows.map((row) => [
    formatThaiDate(row.record.date),
    row.classRoomName,
    String(row.record.period),
    row.originalSubjectCode,
    row.originalSubjectName,
    row.originalSpecialRoomName,
    row.substituteSubjectCode,
    row.substituteSubjectName,
    row.substituteSpecialRoomName,
    row.record.absencePeriod.absence.teacher.name,
    row.substituteTeacherName,
    row.statusLabel
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

  const candidateTeacherIds = Array.from(
    new Set([
      ...swapCandidates.map((item) => item.teacher.id),
      ...substituteCandidates.map((item) => item.teacherId)
    ])
  );
  const candidateSchedules = candidateTeacherIds.length
    ? await prisma.teachingSchedule.findMany({
        where: {
          teacherId: { in: candidateTeacherIds },
          dayOfWeek: { in: hoverWeekDays.map((day) => day.dayOfWeek) }
        },
        include: { classRoom: true, subject: true, specialRoom: true },
        orderBy: [{ teacherId: "asc" }, { dayOfWeek: "asc" }, { period: "asc" }]
      })
    : [];
  const candidateScheduleMap = new Map(
    candidateSchedules.map((schedule) => [`${schedule.teacherId}:${schedule.dayOfWeek}:${schedule.period}`, schedule])
  );

  const activeSubstitution =
    selected?.substitution && selected.substitution.status !== "REJECTED" ? selected.substitution : null;
  const hasResolution = Boolean(activeSubstitution || existingSwapRequest);
  const canEditResolution =
    canApproveScheduleChange &&
    (existingSwapRequest?.status !== "APPROVED" || user.role === "ADMIN") &&
    (activeSubstitution?.status !== "APPROVED" || user.role === "ADMIN");
  const isOwnSelectedAbsence = Boolean(user.teacherId) && selected?.absence.teacherId === user.teacherId;
  // ครูเจ้าของคาบเสนอครูเข้าแทนได้เอง (รายการรออนุมัติจากครูที่ถูกขอ)
  const canProposeSubstituteTeacher = canApproveScheduleChange || isOwnSelectedAbsence;
  const canCancelSubstitution =
    canApproveScheduleChange || (isOwnSelectedAbsence && activeSubstitution?.status === "PENDING");
  const canCancelSwap =
    existingSwapRequest?.status === "PENDING" &&
    (canApproveScheduleChange || (Boolean(user.teacherId) && existingSwapRequest.requesterTeacher.id === user.teacherId));
  const canRespondAsSubstitute =
    activeSubstitution?.status === "PENDING" &&
    Boolean(user.teacherId) &&
    Boolean(activeSubstitution.substituteTeacherId) &&
    activeSubstitution.substituteTeacherId === user.teacherId;
  const canRecordExternalSubstitute =
    canApproveScheduleChange || (Boolean(user.teacherId) && selected?.absence.teacherId === user.teacherId);
  const today = parseDateInput(toDateInputValue());

  // รายการที่รอให้ฉันกดอนุมัติ (เฉพาะที่ยังไม่เลยกำหนด) — แสดงบนสุดของหน้า ไม่ขึ้นกับวันที่ที่เลือกดู
  const myPendingSubstituteApprovals = user.teacherId
    ? await prisma.substitution.findMany({
        where: { substituteTeacherId: user.teacherId, status: "PENDING", date: { gte: today } },
        orderBy: [{ date: "asc" }, { period: "asc" }],
        include: {
          absencePeriod: {
            include: {
              absence: { include: { teacher: true } },
              schedule: { include: { classRoom: true, subject: true, specialRoom: true } }
            }
          }
        }
      })
    : [];
  const myPendingSwapApprovals = user.teacherId
    ? await prisma.swapRequest.findMany({
        where: {
          targetTeacherId: user.teacherId,
          status: "PENDING",
          OR: [{ date: { gte: today } }, { toDate: { gte: today } }]
        },
        orderBy: { date: "asc" },
        include: { requesterTeacher: true }
      })
    : [];
  const myApprovalSwapSchedules = myPendingSwapApprovals.length
    ? await prisma.teachingSchedule.findMany({
        where: { id: { in: myPendingSwapApprovals.flatMap((item) => [item.fromScheduleId, item.toScheduleId]) } },
        include: { classRoom: true, subject: true }
      })
    : [];
  const myApprovalScheduleMap = new Map(myApprovalSwapSchedules.map((schedule) => [schedule.id, schedule]));
  const myApprovalCount = myPendingSubstituteApprovals.length + myPendingSwapApprovals.length;

  // วันที่ที่มีรายการแลกคาบ/เข้าแทนจริง — ทำเป็นปุ่มลัดให้กดดูได้เลย ไม่ต้องเดาวันเอง
  const [recentSwapDates, recentSubstitutionDates] = await Promise.all([
    prisma.swapRequest.findMany({
      where: isTeacherScoped
        ? { OR: [{ requesterTeacherId: user.teacherId ?? "" }, { targetTeacherId: user.teacherId ?? "" }] }
        : {},
      select: { date: true },
      orderBy: { date: "desc" },
      distinct: ["date"],
      take: 8
    }),
    prisma.substitution.findMany({
      where: isTeacherScoped
        ? {
            OR: [
              { substituteTeacherId: user.teacherId ?? "" },
              { absencePeriod: { absence: { teacherId: user.teacherId ?? "" } } }
            ]
          }
        : {},
      select: { date: true },
      orderBy: { date: "desc" },
      distinct: ["date"],
      take: 8
    })
  ]);
  const recordDates = [
    ...new Set([...recentSwapDates, ...recentSubstitutionDates].map((item) => toDateInputValue(item.date)))
  ]
    .sort()
    .reverse()
    .slice(0, 8);

  const selectedIsPast = selected ? selected.absence.date < today : false;
  const canActOnSelected = !selectedIsPast || user.role === "ADMIN";
  const showCandidates = (!selected || isEditing || !hasResolution) && canActOnSelected;

  return (
    <AppShell user={user}>
      <div className="compact-page">
      <div className="page-head">
        <div>
          <h1>จัดการการเปลี่ยนแปลงคาบสอน</h1>
          <p className="muted">แยกการเข้าแทนออกจากการสลับคาบ เพื่อให้ตรวจเงื่อนไขถูกต้องตามความหมายของแต่ละกรณี</p>
        </div>
      </div>

      <section className="grid">
        {myApprovalCount > 0 ? (
          <div className="card">
            <h2>🔔 รอฉันอนุมัติ ({myApprovalCount})</h2>
            <div className="recommendation-list">
              {myPendingSubstituteApprovals.map((item) => (
                <div className="recommendation-item" key={item.id}>
                  <div className="recommendation-main">
                    <strong>ขอให้เข้าสอนแทน</strong>
                    <p className="muted">
                      {formatThaiDate(item.date)} · คาบ {item.period} · {item.absencePeriod.schedule.classRoom.name} ·{" "}
                      {item.absencePeriod.schedule.subject.name}
                      {item.absencePeriod.schedule.specialRoom ? ` · ${item.absencePeriod.schedule.specialRoom.name}` : ""} ·
                      ครูเดิม: <span className="no-glossary">{item.absencePeriod.absence.teacher.name}</span>
                      {item.note && item.note !== "เข้าแทน" ? ` · หมายเหตุ: ${item.note}` : ""}
                    </p>
                  </div>
                  <div className="actions">
                    <form action="/api/swaps" method="post">
                      <input type="hidden" name="intent" value="approve_substitute" />
                      <input type="hidden" name="absencePeriodId" value={item.absencePeriodId} />
                      <button className="btn primary" type="submit">
                        อนุมัติ
                      </button>
                    </form>
                    <form action="/api/swaps" method="post">
                      <input type="hidden" name="intent" value="reject_substitute" />
                      <input type="hidden" name="absencePeriodId" value={item.absencePeriodId} />
                      <button className="btn danger" type="submit">
                        ไม่อนุมัติ
                      </button>
                    </form>
                  </div>
                </div>
              ))}
              {myPendingSwapApprovals.map((request) => {
                const fromSchedule = myApprovalScheduleMap.get(request.fromScheduleId);
                const toSchedule = myApprovalScheduleMap.get(request.toScheduleId);
                const toDate =
                  request.toDate ?? (toSchedule ? nextDateForDayOfWeek(request.date, toSchedule.dayOfWeek) : null);
                return (
                  <div className="recommendation-item" key={request.id}>
                    <div className="recommendation-main">
                      <strong>ขอสลับคาบ</strong>
                      <p className="muted">
                        จาก <span className="no-glossary">{request.requesterTeacher.name}</span> ·{" "}
                        {formatThaiDate(request.date)} คาบ {fromSchedule?.period ?? "-"} (
                        {fromSchedule?.classRoom.name ?? "-"} {fromSchedule?.subject.name ?? ""}) ⇄{" "}
                        {toDate ? formatThaiDate(toDate) : "-"} คาบ {toSchedule?.period ?? "-"} (
                        {toSchedule?.classRoom.name ?? "-"} {toSchedule?.subject.name ?? ""})
                        {request.note ? ` · เหตุผล: ${request.note}` : ""}
                      </p>
                    </div>
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
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="card card-pending">
          <h2>คาบไปราชการ/ลากิจ/ไม่มาปฏิบัติงาน (คาบที่ยังไม่แลกคาบหรือขอให้สอนแทน)</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ประเภท</th>
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
                    <td>
                      <span className={`badge ${period.absence.type === "LEAVE" ? "warning" : ""}`}>
                        {absenceTypeLabel(period.absence.type)}
                      </span>
                    </td>
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

        <div className="card swap-detail-panel">
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
                      {activeSubstitution ? (
                        <>
                          <strong>{activeSubstitution.status === "APPROVED" ? "เข้าแทนแล้ว" : "รออนุมัติจากครูเข้าแทน"}</strong>
                          <p className="muted">
                            ผู้เข้าแทน:{" "}
                            <span className="no-glossary">
                              {activeSubstitution.externalSubstituteName
                                ? `นิสิต/นักศึกษาฝึกประสบการณ์: ${activeSubstitution.externalSubstituteName}`
                                : substituteTeacherMap.get(activeSubstitution.substituteTeacherId ?? "")?.name ??
                                  "ไม่พบข้อมูลครู"}
                            </span>
                          </p>
                          <span className={`badge ${activeSubstitution.status === "APPROVED" ? "success" : "warning"}`}>
                            {activeSubstitution.status === "APPROVED" ? "อนุมัติแล้ว" : "รออนุมัติ"}
                          </span>
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
                      {canRespondAsSubstitute ? (
                        <>
                          <form action="/api/swaps" method="post">
                            <input type="hidden" name="intent" value="approve_substitute" />
                            <input type="hidden" name="absencePeriodId" value={selected.id} />
                            <button className="btn primary" type="submit">
                              อนุมัติเข้าแทน
                            </button>
                          </form>
                          <form action="/api/swaps" method="post">
                            <input type="hidden" name="intent" value="reject_substitute" />
                            <input type="hidden" name="absencePeriodId" value={selected.id} />
                            <button className="btn danger" type="submit">
                              ไม่อนุมัติ
                            </button>
                          </form>
                        </>
                      ) : null}
                      {activeSubstitution && canCancelSubstitution ? (
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
                <p className="badge warning">คาบย้อนหลังไม่สามารถดำเนินการได้</p>
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
                    {swapCandidates.length === 0 ? (
                      <p className="muted">
                        ไม่มีคาบที่สลับได้สำหรับคาบนี้ — คาบปลายทางต้องเป็นคาบของห้องเรียน/กลุ่มห้องเดียวกัน
                        สอนโดยครูคนอื่น เป็นวิชาที่สลับได้ (ไม่ใช่คาบกิจกรรม) และครูทั้งสองฝั่งต้องว่างในคาบของกันและกัน
                        หากไม่พบคาบที่เข้าเงื่อนไข แนะนำให้ใช้ &quot;ประเภทที่ 2: เข้าแทน&quot; แทน
                      </p>
                    ) : (
                    <>
                    <TableTeacherSearch targetId="swap-candidate-table" />
                    <div className="table-wrap" id="swap-candidate-table">
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
                            <tr key={item.id} data-teacher-name={item.teacher.name}>
                              <td>
                                {thaiDays[item.dayOfWeek]} คาบ {item.period}
                              </td>
                              <td>
                                <TeacherHoverSchedule
                                  name={item.teacher.name}
                                  teacherId={item.teacher.id}
                                  scheduleMap={candidateScheduleMap}
                                />
                              </td>
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
                                  <ul className="compact-list warning-text">
                                    {item.warnings.map((warning) => (
                                      <li key={warning}>{warning}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span className="muted warning-text">ผ่านเงื่อนไข</span>
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
                    </>
                    )}
                  </section>

                  <section>
                    <h3>ประเภทที่ 2: เข้าแทน</h3>
                    <p className="muted">
                      ใช้วันเดิม คาบเดิม ห้องเดิม และรายวิชาเดิม เปลี่ยนเฉพาะครูผู้สอน โดยครูเข้าแทนต้องว่างในคาบนี้
                    </p>
                    {canApproveScheduleChange || canRecordExternalSubstitute ? (
                      <>
                      {canProposeSubstituteTeacher && substituteCandidates.length === 0 ? (
                        <p className="muted">
                          ยังไม่พบครูที่ว่างและผ่านเงื่อนไขในคาบนี้ (ครูที่ติดสอน ติดสอนแทน หรือลาในวันเดียวกัน
                          จะไม่ปรากฏในรายชื่อ)
                        </p>
                      ) : null}
                      {canProposeSubstituteTeacher && substituteCandidates.length > 0 ? (
                        <>
                          {!canApproveScheduleChange ? (
                            <p className="muted">
                              เลือกครูเพื่อส่งคำขอเข้าแทน รายการจะมีสถานะ &quot;รออนุมัติ&quot;
                              จนกว่าครูที่ถูกขอจะกดอนุมัติในหน้านี้
                            </p>
                          ) : null}
                          <TableTeacherSearch targetId="substitute-candidate-table" />
                          <div className="table-wrap" id="substitute-candidate-table">
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
                                  <tr key={item.teacherId} data-teacher-name={item.teacherName}>
                                    <td>
                                      <TeacherHoverSchedule
                                        name={item.teacherName}
                                        teacherId={item.teacherId}
                                        scheduleMap={candidateScheduleMap}
                                      />
                                    </td>
                                    <td>{item.departmentName}</td>
                                    <td>{item.score}</td>
                                    <td>
                                      <span className="warning-text">{[...item.reasons, ...item.warnings].join(", ")}</span>
                                      <br />
                                      <span className="muted warning-text">
                                        {selected.schedule.classRoom.name} {selected.schedule.subject.name} →{" "}
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
                                          defaultValue={
                                            selected.substitution?.externalSubstituteName
                                              ? selected.absence.note ?? ""
                                              : selected.substitution?.note ?? selected.absence.note ?? ""
                                          }
                                        />
                                        <button className="btn primary" type="submit">
                                          {canApproveScheduleChange ? "ยืนยันเข้าแทน" : "เสนอเข้าแทน (รออนุมัติ)"}
                                        </button>
                                      </form>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : null}
                      <div className="recommendation-item">
                        <div className="recommendation-main">
                          <strong>นิสิตนักศึกษาฝึกประสบการณ์วิชาชีพเข้าแทน</strong>
                          <p className="muted">ใช้กรณีมีนิสิต/นักศึกษาฝึกประสบการณ์รับผิดชอบคาบนี้แทนครู</p>
                        </div>
                        <form className="form" action="/api/swaps" method="post">
                          <input type="hidden" name="intent" value="external_substitute" />
                          <input type="hidden" name="absencePeriodId" value={selected.id} />
                          <select name="subjectId" defaultValue={selected.schedule.subjectId} aria-label="รายวิชา">
                            {subjects.map((subject) => (
                              <option key={subject.id} value={subject.id}>
                                {subject.name}
                              </option>
                            ))}
                          </select>
                          <input
                            name="externalSubstituteName"
                            placeholder="ชื่อนิสิต/นักศึกษา"
                            required
                          />
                          <button className="btn primary" type="submit">
                            ยืนยันเข้าแทน
                          </button>
                        </form>
                      </div>
                      </>
                    ) : (
                      <p className="muted">การบันทึกเข้าแทนต้องให้ผู้ดูแลหรือหัวหน้าที่มีสิทธิ์อนุมัติเป็นผู้ดำเนินการ</p>
                    )}
                  </section>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="card view-date-card">
          <form className="view-date-form" method="get">
            {absencePeriodId ? <input type="hidden" name="absencePeriodId" value={absencePeriodId} /> : null}
            {isEditing ? <input type="hidden" name="edit" value="1" /> : null}
            <label>
              แสดงข้อมูลวันที่:
              <input type="date" name="viewDate" defaultValue={selectedViewDate} />
            </label>
            <button className="btn primary" type="submit">
              แสดง
            </button>
            <a className="btn" href={todayHref}>
              วันนี้
            </a>
          </form>
          {recordDates.length > 0 ? (
            <div className="actions" style={{ marginTop: "0.5rem", flexWrap: "wrap" }}>
              <span className="muted">วันที่มีรายการ:</span>
              {recordDates.map((dateValue) => (
                <a
                  key={dateValue}
                  className={`btn ${dateValue === selectedViewDate ? "primary" : ""}`}
                  href={`/swaps?viewDate=${dateValue}${absencePeriodId ? `&absencePeriodId=${absencePeriodId}` : ""}`}
                >
                  {formatThaiDate(parseDateInput(dateValue))}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <div className="card card-resolved">
          <h2>รายการแลกคาบ (สลับคาบ)</h2>
          {swapTableRows.length === 0 ? (
            <p className="muted">
              ไม่มีรายการในวันที่เลือก — กดปุ่ม &quot;วันที่มีรายการ&quot; ด้านบนเพื่อดูและ Export รูปภาพ
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>วันที่ลาหรือราชการ</th>
                    <th>ชั้น ม.</th>
                    <th>คาบ</th>
                    <th>รหัสวิชา</th>
                    <th>ชื่อรายวิชา</th>
                    <th>ห้อง/อาคาร</th>
                    <th>วันที่แลกคาบ/สลับคาบ</th>
                    <th>คาบเรียนที่สลับคาบ</th>
                    <th>รหัสวิชาที่สลับคาบ</th>
                    <th>ชื่อรายวิชาที่สลับคาบ</th>
                    <th>ห้อง/อาคารที่สลับคาบ</th>
                    <th>ครูที่รับแลกคาบ</th>
                    <th>การอนุมัติ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {swapTableRows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatThaiDate(row.request.date)}</td>
                      <td>{row.classRoomName}</td>
                      <td>{row.period}</td>
                      <td>{row.subjectCode}</td>
                      <td>{row.subjectName}</td>
                      <td>{row.specialRoomName}</td>
                      <td>{formatThaiDate(row.toDate)}</td>
                      <td>{row.toPeriod}</td>
                      <td>{row.toSubjectCode}</td>
                      <td>{row.toSubjectName}</td>
                      <td>{row.toSpecialRoomName}</td>
                      <td className="no-glossary">{row.request.targetTeacher.name}</td>
                      <td>
                        <span
                          className={`badge ${
                            row.request.status === "APPROVED"
                              ? "success"
                              : row.request.status === "REJECTED"
                                ? "danger"
                                : "warning"
                          }`}
                        >
                          {row.statusLabel}
                        </span>
                        {row.request.splitDoublePeriod ? <span className="badge warning">แตกคาบคู่</span> : null}
                      </td>
                      <td>
                        {canApproveScheduleChange || user.teacherId === row.request.targetTeacherId ? (
                          <div className="actions">
                            {row.request.status !== "APPROVED" ? (
                              <form action="/api/swaps" method="post">
                                <input type="hidden" name="intent" value="approve" />
                                <input type="hidden" name="id" value={row.request.id} />
                                <button className="btn primary" type="submit">
                                  อนุมัติ
                                </button>
                              </form>
                            ) : null}
                            {row.request.status !== "REJECTED" ? (
                              <form action="/api/swaps" method="post">
                                <input type="hidden" name="intent" value="reject" />
                                <input type="hidden" name="id" value={row.request.id} />
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
          )}
          <ExportTablePng
            title="รายการแลกคาบ (สลับคาบ)"
            dateLabel={`วันที่ลาหรือราชการ: ${formatThaiDate(viewDateStart)}`}
            columns={swapExportColumns}
            rows={swapExportRows}
            filename={`swap_periods_${selectedViewDate}.png`}
          />
        </div>

        <div className="card card-resolved">
          <h2>รายการเข้าแทน</h2>
          {substitutionTableRows.length === 0 ? (
            <p className="muted">
              ไม่มีรายการในวันที่เลือก — กดปุ่ม &quot;วันที่มีรายการ&quot; ด้านบนเพื่อดูและ Export รูปภาพ
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>วันที่ลาหรือราชการ</th>
                    <th>ชั้น ม.</th>
                    <th>คาบ</th>
                    <th>รหัสวิชาเดิม</th>
                    <th>ชื่อรายวิชาเดิม</th>
                    <th>ห้อง/อาคารเดิม</th>
                    <th>รหัสวิชาที่สอนแทน</th>
                    <th>ชื่อรายวิชาที่สอนแทน</th>
                    <th>ห้อง/อาคารที่สอนแทน</th>
                    <th>ครูต้นทาง</th>
                    <th>ครูเข้าแทน</th>
                    <th>การอนุมัติ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {substitutionTableRows.map((row) => {
                    const canRespondToThisRow =
                      row.record.status === "PENDING" &&
                      Boolean(row.record.substituteTeacherId) &&
                      Boolean(user.teacherId) &&
                      row.record.substituteTeacherId === user.teacherId;
                    return (
                      <tr key={row.id}>
                        <td>{formatThaiDate(row.record.date)}</td>
                        <td>{row.classRoomName}</td>
                        <td>{row.record.period}</td>
                        <td>{row.originalSubjectCode}</td>
                        <td>{row.originalSubjectName}</td>
                        <td>{row.originalSpecialRoomName}</td>
                        <td>{row.substituteSubjectCode}</td>
                        <td>{row.substituteSubjectName}</td>
                        <td>{row.substituteSpecialRoomName}</td>
                        <td className="no-glossary">{row.record.absencePeriod.absence.teacher.name}</td>
                        <td className="no-glossary">{row.substituteTeacherName}</td>
                        <td>
                          <span
                            className={`badge ${
                              row.record.status === "APPROVED"
                                ? "success"
                                : row.record.status === "REJECTED"
                                  ? "danger"
                                  : "warning"
                            }`}
                          >
                            {row.statusLabel}
                          </span>
                        </td>
                        <td>
                          {canRespondToThisRow || canApproveScheduleChange ? (
                            <div className="actions">
                              {canRespondToThisRow ? (
                                <>
                                  <form action="/api/swaps" method="post">
                                    <input type="hidden" name="intent" value="approve_substitute" />
                                    <input type="hidden" name="absencePeriodId" value={row.record.absencePeriodId} />
                                    <button className="btn primary" type="submit">
                                      อนุมัติ
                                    </button>
                                  </form>
                                  <form action="/api/swaps" method="post">
                                    <input type="hidden" name="intent" value="reject_substitute" />
                                    <input type="hidden" name="absencePeriodId" value={row.record.absencePeriodId} />
                                    <button className="btn danger" type="submit">
                                      ไม่อนุมัติ
                                    </button>
                                  </form>
                                </>
                              ) : null}
                              {canApproveScheduleChange ? (
                                <>
                                  <a className="btn" href={`/swaps?absencePeriodId=${row.record.absencePeriodId}&edit=1`}>
                                    แก้ไข
                                  </a>
                                  <form action="/api/swaps" method="post">
                                    <input type="hidden" name="intent" value="cancel_substitute" />
                                    <input type="hidden" name="absencePeriodId" value={row.record.absencePeriodId} />
                                    <button className="btn danger" type="submit">
                                      ยกเลิก
                                    </button>
                                  </form>
                                </>
                              ) : null}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <ExportTablePng
            title="รายการเข้าแทน"
            dateLabel={`วันที่: ${formatThaiDate(viewDateStart)}`}
            columns={substitutionExportColumns}
            rows={substitutionExportRows}
            filename={`substitute_${selectedViewDate}.png`}
          />
        </div>
      </section>
      </div>
    </AppShell>
  );
}

function absenceTypeLabel(type: "LEAVE" | "PERSONAL" | "OFFICIAL") {
  if (type === "LEAVE") return "ไม่มาปฏิบัติงาน";
  if (type === "PERSONAL") return "ลากิจ";
  return "ไปราชการ";
}
