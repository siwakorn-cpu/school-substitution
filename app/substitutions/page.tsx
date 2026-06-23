import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageSubstitution } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { formatThaiDate, parseDateInput, toDateInputValue } from "@/lib/date";
import { recommendSubstitutes } from "@/lib/recommendSubstitutes";
import { getDepartmentScopeId, roleUsesDepartmentScope } from "@/lib/departmentScope";
import { ShareSubstitutionImage } from "@/components/ShareSubstitutionImage";
import type { ShareSubstitutionData } from "@/components/ShareSubstitutionImage";

const hoverWeekDays = [
  { dayOfWeek: 1, label: "จันทร์" },
  { dayOfWeek: 2, label: "อังคาร" },
  { dayOfWeek: 3, label: "พุธ" },
  { dayOfWeek: 4, label: "พฤหัส" },
  { dayOfWeek: 5, label: "ศุกร์" }
];
const hoverPeriods = Array.from({ length: 10 }, (_, index) => index + 1);

export default async function SubstitutionsPage({
  searchParams
}: {
  searchParams: Promise<{
    absencePeriodId?: string;
    edit?: string;
    sortDate?: string;
    dateScope?: string;
    departmentId?: string;
    printStartDate?: string;
    printEndDate?: string;
    printTeacherId?: string;
    printDepartmentId?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const [
    canAssignSubstitution,
    canExportTeacherSubstitutionImage,
    canExportDepartmentSubstitutionImage,
    canExportDailySubstitutionImage
  ] = await Promise.all([
    canManageSubstitution(user),
    hasPermission(user, "export_teacher_substitution_image"),
    hasPermission(user, "export_department_substitution_image"),
    hasPermission(user, "export_daily_substitution_image")
  ]);
  const departmentScopeId = await getDepartmentScopeId(user);
  const usesDepartmentScope = roleUsesDepartmentScope(user);
  if (!canAssignSubstitution && !user.teacherId) {
    return (
      <AppShell user={user}>
        <p className="error">บัญชีนี้ไม่มีสิทธิ์จัดสอนแทน</p>
      </AppShell>
    );
  }
  const absencePeriodId = params.absencePeriodId ?? "";
  const isEditing = params.edit === "1";
  const sortDate = params.sortDate === "asc" ? "asc" : "desc";
  const dateScope = params.dateScope === "today" ? "today" : "all";
  const canUsePrintExports =
    canExportTeacherSubstitutionImage || canExportDepartmentSubstitutionImage || canExportDailySubstitutionImage;
  const departments = await prisma.department.findMany({
    where: usesDepartmentScope ? { id: departmentScopeId ?? "__none__" } : {},
    orderBy: { name: "asc" }
  });
  const selectedDepartmentId = usesDepartmentScope
    ? departmentScopeId ?? "__none__"
    : departments.some((department) => department.id === params.departmentId)
    ? params.departmentId ?? "all"
    : "all";
  const today = parseDateInput(toDateInputValue());
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const absenceWhere: Prisma.TeacherAbsenceWhereInput = { type: "LEAVE" };

  if (dateScope === "today") {
    absenceWhere.date = { gte: today, lt: tomorrow };
  }

  if (selectedDepartmentId !== "all") {
    absenceWhere.teacher = { departmentId: selectedDepartmentId };
  }

  const pendingPeriodWhere: Prisma.AbsencePeriodWhereInput = !canAssignSubstitution
    ? { substitution: { substituteTeacherId: user.teacherId ?? "" } }
    : {};

  if (Object.keys(absenceWhere).length > 0) {
    pendingPeriodWhere.absence = absenceWhere;
  }

  const pendingPeriods = await prisma.absencePeriod.findMany({
    where: pendingPeriodWhere,
    include: {
      absence: { include: { teacher: true } },
      schedule: { include: { classRoom: true, subject: true, specialRoom: true } },
      substitution: true
    },
    orderBy: [{ absence: { date: sortDate } }, { period: "asc" }],
    take: 50
  });

  const selectedWhere: Prisma.AbsencePeriodWhereInput = {
    id: absencePeriodId || "__none__",
    absence: {
      type: "LEAVE",
      ...(usesDepartmentScope ? { teacher: { departmentId: departmentScopeId ?? "__none__" } } : {})
    }
  };
  const selected = absencePeriodId
    ? await prisma.absencePeriod.findFirst({
        where: selectedWhere,
        include: {
          absence: { include: { teacher: { include: { department: true } } } },
          schedule: { include: { classRoom: true, subject: true, specialRoom: true } },
          substitution: true
        }
      })
    : null;
  const currentSubstitute = selected?.substitution
    ? await prisma.teacher.findUnique({
        where: { id: selected.substitution.substituteTeacherId },
        include: { department: true }
      })
    : null;
  // Audit trail (who assigned + when) — visible to ADMIN only.
  const assignedByUser =
    user.role === "ADMIN" && selected?.substitution
      ? await prisma.user.findUnique({
          where: { id: selected.substitution.assignedById },
          select: { username: true }
        })
      : null;
  const printStartDateValue = params.printStartDate ?? toDateInputValue();
  const printEndDateValue = params.printEndDate ?? printStartDateValue;
  const printStartDate = parseDateInput(printStartDateValue);
  const rawPrintEndDate = parseDateInput(printEndDateValue);
  const printEndDate = rawPrintEndDate < printStartDate ? printStartDate : rawPrintEndDate;
  const printEndExclusive = new Date(printEndDate.getFullYear(), printEndDate.getMonth(), printEndDate.getDate() + 1);
  const printDepartments = departments;
  const printTeachers = canUsePrintExports
    ? await prisma.teacher.findMany({
        where: {
          status: "ACTIVE",
          ...(usesDepartmentScope ? { departmentId: departmentScopeId ?? "__none__" } : {})
        },
        include: { department: true },
        orderBy: [{ department: { name: "asc" } }, { code: "asc" }]
      })
    : [];
  const selectedPrintTeacherId = printTeachers.some((teacher) => teacher.id === params.printTeacherId)
    ? params.printTeacherId ?? ""
    : selected?.absence.teacherId ?? printTeachers[0]?.id ?? "";
  const selectedPrintTeacher = printTeachers.find((teacher) => teacher.id === selectedPrintTeacherId) ?? null;
  const selectedPrintDepartmentId = usesDepartmentScope
    ? departmentScopeId ?? "__none__"
    : printDepartments.some((department) => department.id === params.printDepartmentId)
    ? params.printDepartmentId ?? ""
    : selected?.absence.teacher.departmentId ?? selectedPrintTeacher?.departmentId ?? printDepartments[0]?.id ?? "";
  const selectedPrintDepartment = printDepartments.find((department) => department.id === selectedPrintDepartmentId) ?? null;
  const requiredSharePeriods = canUsePrintExports
    ? await prisma.absencePeriod.findMany({
        where: {
          absence: {
            type: "LEAVE",
            date: { gte: printStartDate, lt: printEndExclusive },
            ...(usesDepartmentScope ? { teacher: { departmentId: departmentScopeId ?? "__none__" } } : {})
          }
        },
        include: {
          absence: { include: { teacher: { include: { department: true } } } },
          schedule: { include: { classRoom: true, subject: true, specialRoom: true } },
          substitution: true
        },
        orderBy: [{ absence: { date: "asc" } }, { absence: { teacher: { code: "asc" } } }, { period: "asc" }]
      })
    : [];
  const sharePeriods = requiredSharePeriods.filter((period) => isSubstitutionComplete(period));
  const substituteTeachers =
    sharePeriods.length > 0
      ? await prisma.teacher.findMany({
          where: {
            id: {
              in: sharePeriods
                .map((period) => period.substitution?.substituteTeacherId)
                .filter((teacherId): teacherId is string => Boolean(teacherId))
            }
          },
          include: { department: true }
        })
      : [];
  const substituteTeacherMap = new Map(substituteTeachers.map((teacher) => [teacher.id, teacher]));
  const shareItemsForDay = sharePeriods
    .map<ShareSubstitutionData | null>((period) => {
      const substituteTeacher = period.substitution
        ? substituteTeacherMap.get(period.substitution.substituteTeacherId)
        : null;
      if (!substituteTeacher) return null;

      return {
        date: formatThaiDate(period.absence.date),
        period: period.period,
        classRoom: period.schedule.classRoom.name,
        subject: period.schedule.subject.name,
        originalTeacher: `${period.absence.teacher.name} (${period.absence.teacher.department.name})`,
        substituteTeacher: `${substituteTeacher.code} - ${substituteTeacher.name} (${substituteTeacher.department.name})`,
        specialRoom: period.schedule.specialRoom?.name ?? null,
        note: period.substitution?.note ?? null
      };
    })
    .filter((item): item is ShareSubstitutionData => Boolean(item));
  const shareItemsForSelectedTeacher = selectedPrintTeacher
    ? shareItemsForDay.filter((item) => item.originalTeacher.startsWith(selectedPrintTeacher.name))
    : [];
  const shareItemsForSelectedDepartment = selectedPrintDepartment
    ? shareItemsForDay.filter((item) => item.originalTeacher.includes(`(${selectedPrintDepartment.name})`))
    : [];
  const selectedTeacherPeriods = selectedPrintTeacher
    ? requiredSharePeriods.filter((period) => period.absence.teacherId === selectedPrintTeacher.id)
    : [];
  const selectedDepartmentPeriods = selectedPrintDepartment
    ? requiredSharePeriods.filter((period) => period.absence.teacher.departmentId === selectedPrintDepartment.id)
    : [];
  const selectedTeacherComplete =
    selectedTeacherPeriods.length > 0 && selectedTeacherPeriods.every((period) => isSubstitutionComplete(period));
  const selectedDepartmentComplete =
    selectedDepartmentPeriods.length > 0 && selectedDepartmentPeriods.every((period) => isSubstitutionComplete(period));
  const printRangeLabel =
    printStartDateValue === printEndDateValue
      ? formatThaiDate(printStartDate)
      : `${formatThaiDate(printStartDate)} - ${formatThaiDate(printEndDate)}`;
  const recommendations =
    selected && canAssignSubstitution
      ? await recommendSubstitutes(selected.id, { departmentId: usesDepartmentScope ? departmentScopeId : null })
      : [];
  const recommendationSchedules =
    recommendations.length > 0
      ? await prisma.teachingSchedule.findMany({
          where: {
            teacherId: { in: recommendations.map((item) => item.teacherId) },
            dayOfWeek: { in: hoverWeekDays.map((day) => day.dayOfWeek) }
          },
          include: { classRoom: true, subject: true, specialRoom: true },
          orderBy: [{ teacherId: "asc" }, { dayOfWeek: "asc" }, { period: "asc" }]
        })
      : [];
  const recommendationScheduleMap = new Map(
    recommendationSchedules.map((schedule) => [`${schedule.teacherId}:${schedule.dayOfWeek}:${schedule.period}`, schedule])
  );
  const listQuery = new URLSearchParams({
    sortDate,
    dateScope,
    departmentId: selectedDepartmentId
  });
  const selectedIsPast = selected ? selected.absence.date < today : false;
  const canEditSelectedSubstitution = canAssignSubstitution && (!selectedIsPast || user.role === "ADMIN");
  const shouldEditSelectedSubstitution = isEditing && canEditSelectedSubstitution;

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>จัดครูสอนแทน</h1>
          <p className="muted">ระบบแนะนำครูที่ว่างและเหมาะสมที่สุดตามภาระงาน</p>
        </div>
      </div>

      <section className="grid">
        <div className="card span-4">
          <h2>รายการคาบ</h2>
          <form className="compact-form" method="get">
            {absencePeriodId ? <input type="hidden" name="absencePeriodId" value={absencePeriodId} /> : null}
            {isEditing ? <input type="hidden" name="edit" value="1" /> : null}
            <label>
              ช่วงวันที่
              <select name="dateScope" defaultValue={dateScope}>
                <option value="all">ทั้งหมด</option>
                <option value="today">วันนี้</option>
              </select>
            </label>
            <label>
              กลุ่มสาระ
              <select name="departmentId" defaultValue={selectedDepartmentId} disabled={usesDepartmentScope}>
                {!usesDepartmentScope ? <option value="all">ทุกกลุ่มสาระ</option> : null}
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              เรียงตามวันที่
              <select name="sortDate" defaultValue={sortDate}>
                <option value="desc">ล่าสุดก่อน</option>
                <option value="asc">เก่าก่อน</option>
              </select>
            </label>
            <button className="btn" type="submit">
              แสดงรายการ
            </button>
          </form>
          <div className="table-wrap no-scroll">
            <table className="period-list-table">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ครูเดิม</th>
                  <th>คาบ</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {pendingPeriods.map((period) => (
                  <tr key={period.id}>
                    <td>
                      <a
                        href={`/substitutions?${new URLSearchParams({
                          ...Object.fromEntries(listQuery),
                          absencePeriodId: period.id
                        }).toString()}`}
                      >
                        {formatThaiDate(period.absence.date)}
                      </a>
                    </td>
                    <td className="no-glossary">{period.absence.teacher.name}</td>
                    <td>{period.period}</td>
                    <td>
                      <span className={`badge ${period.status === "DONE" ? "success" : "warning"}`}>
                        {period.status === "DONE" ? "เสร็จแล้ว" : "รอจัด"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card span-8">
          {!selected ? (
            <p className="muted">เลือกรายการคาบทางซ้ายเพื่อดูครูที่แนะนำ</p>
          ) : (
            <>
              <h2>คาบที่ต้องจัดแทน</h2>
              <p>
                {formatThaiDate(selected.absence.date)} · คาบ {selected.period} · {selected.schedule.classRoom.name} ·{" "}
                {selected.schedule.subject.name}
              </p>
              <p className="muted">
                ครูเดิม: <span className="no-glossary">{selected.absence.teacher.name}</span> (
                {selected.absence.teacher.department.name})
                {selected.schedule.specialRoom ? ` · ห้อง/อาคาร: ${selected.schedule.specialRoom.name}` : ""}
              </p>

              {selected.substitution && !shouldEditSelectedSubstitution ? (
                <div className="recommendation-list">
                  <div className="recommendation-item">
                    <div className="recommendation-main">
                      <strong>จัดครูสอนแทนแล้ว</strong>
                      <p className="muted">
                        ครูสอนแทนปัจจุบัน:{" "}
                        {currentSubstitute ? (
                          <span className="no-glossary">
                            {currentSubstitute.code} - {currentSubstitute.name} ({currentSubstitute.department.name})
                          </span>
                        ) : (
                          "ไม่พบข้อมูลครู"
                        )}
                      </p>
                      {user.role === "ADMIN" && selected.substitution ? (
                        <p className="muted audit-line">
                          บันทึกโดย: <span className="no-glossary">{assignedByUser?.username ?? "ไม่ทราบ"}</span> · เมื่อ{" "}
                          {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(
                            selected.substitution.createdAt
                          )}
                        </p>
                      ) : null}
                    </div>
                    {canEditSelectedSubstitution ? (
                      <a
                        className="btn primary"
                        href={`/substitutions?${new URLSearchParams({
                          ...Object.fromEntries(listQuery),
                          absencePeriodId: selected.id,
                          edit: "1"
                        }).toString()}`}
                      >
                        แก้ไขการจัดสอนแทน
                      </a>
                    ) : selectedIsPast ? (
                      <span className="badge warning">ย้อนหลังแก้ไขได้เฉพาะผู้ดูแลระบบ</span>
                    ) : null}
                  </div>
                </div>
              ) : !canAssignSubstitution ? (
                <p className="muted">บัญชีครูดูรายการของตนเองได้ แต่จัดครูแทนไม่ได้</p>
              ) : recommendations.length === 0 ? (
                <p className="error">ยังไม่พบครูที่ผ่านเงื่อนไขในคาบนี้</p>
              ) : (
                <div className="recommendation-list">
                  {selected.substitution && shouldEditSelectedSubstitution ? (
                    <div className="actions">
                      <span className="badge warning">กำลังแก้ไขการจัดสอนแทน</span>
                      <a
                        className="btn"
                        href={`/substitutions?${new URLSearchParams({
                          ...Object.fromEntries(listQuery),
                          absencePeriodId: selected.id
                        }).toString()}`}
                      >
                        ยกเลิก
                      </a>
                    </div>
                  ) : null}
                  {recommendations.map((item) => (
                    <div className="recommendation-item" key={item.teacherId}>
                      <div className="recommendation-main">
                        <div className="teacher-name-hover no-glossary" tabIndex={0}>
                          <strong>
                            {item.teacherCode} - {item.teacherName}
                          </strong>
                          <div className="teacher-hover-schedule" role="tooltip">
                            <strong>ตารางสอน จันทร์-ศุกร์</strong>
                            <table className="teacher-hover-table">
                              <thead>
                                <tr>
                                  <th>วัน</th>
                                  {hoverPeriods.map((period) => (
                                    <th key={period}>{period}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {hoverWeekDays.map((day) => (
                                  <tr key={day.dayOfWeek}>
                                    <th>{day.label}</th>
                                    {hoverPeriods.map((period) => {
                                      const schedule = recommendationScheduleMap.get(`${item.teacherId}:${day.dayOfWeek}:${period}`);
                                      return (
                                        <td key={`${day.dayOfWeek}-${period}`}>
                                          {schedule ? (
                                            <>
                                              <span>{schedule.classRoom.name}</span>
                                              <small>{schedule.subject.name}</small>
                                              {schedule.specialRoom ? <small>{schedule.specialRoom.name}</small> : null}
                                            </>
                                          ) : (
                                            "-"
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="actions">
                          <span className="badge">{item.departmentName}</span>
                          <span className="badge success">คะแนน {item.score}</span>
                          {selected.substitution?.substituteTeacherId === item.teacherId ? (
                            <span className="badge warning">ครูที่เลือกไว้</span>
                          ) : null}
                          {item.warnings.map((warning) => (
                            <span className="badge warning" key={warning}>
                              {warning}
                            </span>
                          ))}
                        </div>
                        <p className="muted">{item.reasons.join(" / ")}</p>
                      </div>
                      <form action="/api/substitutions" method="post">
                        <input type="hidden" name="absencePeriodId" value={selected.id} />
                        <input type="hidden" name="substituteTeacherId" value={item.teacherId} />
                        <button className="btn primary" type="submit">
                          {selected.substitution ? "บันทึกครูคนนี้" : "เลือกครูคนนี้"}
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {canUsePrintExports ? (
          <div className="card">
            <h2>ปริ๊นต์เอาภาพสอนแทน</h2>
            <form className="print-export-form" method="get">
              {absencePeriodId ? <input type="hidden" name="absencePeriodId" value={absencePeriodId} /> : null}
              <input type="hidden" name="sortDate" value={sortDate} />
              <input type="hidden" name="dateScope" value={dateScope} />
              <input type="hidden" name="departmentId" value={selectedDepartmentId} />
              <label>
                วันที่เริ่ม
                <input name="printStartDate" type="date" defaultValue={printStartDateValue} />
              </label>
              <label>
                วันที่สิ้นสุด
                <input name="printEndDate" type="date" defaultValue={printEndDateValue} />
              </label>
              {canExportTeacherSubstitutionImage ? (
                <label>
                  ครู
                  <select name="printTeacherId" defaultValue={selectedPrintTeacherId}>
                    {printTeachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.code} - {teacher.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {canExportDepartmentSubstitutionImage ? (
                <label>
                  กลุ่มสาระ
                  <select name="printDepartmentId" defaultValue={selectedPrintDepartmentId} disabled={usesDepartmentScope}>
                    {printDepartments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button className="btn" type="submit">
                แสดงตัวเลือก
              </button>
            </form>
            <div className="share-export-grid">
              {canExportTeacherSubstitutionImage ? (
                <ShareSubstitutionImage
                  title="สรุปสอนแทนรายครู"
                  subtitle={selectedPrintTeacher ? `ครูเดิม: ${selectedPrintTeacher.name} · ${printRangeLabel}` : printRangeLabel}
                  filename={`สอนแทน-${printRangeLabel}-${selectedPrintTeacher?.name ?? "รายครู"}`}
                  items={shareItemsForSelectedTeacher}
                  disabledReason={selectedTeacherComplete ? null : "จัดสอนแทนครูคนนี้ให้ครบก่อน"}
                />
              ) : null}
              {canExportDepartmentSubstitutionImage ? (
                <ShareSubstitutionImage
                  title="สรุปสอนแทนรายกลุ่มสาระ"
                  subtitle={selectedPrintDepartment ? `กลุ่มสาระ: ${selectedPrintDepartment.name} · ${printRangeLabel}` : printRangeLabel}
                  filename={`สอนแทน-${printRangeLabel}-${selectedPrintDepartment?.name ?? "รายกลุ่มสาระ"}`}
                  items={shareItemsForSelectedDepartment}
                  disabledReason={selectedDepartmentComplete ? null : "จัดสอนแทนครูที่ลาป่วยในกลุ่มสาระนี้ให้ครบก่อน"}
                />
              ) : null}
              {canExportDailySubstitutionImage ? (
                <ShareSubstitutionImage
                  title="สรุปสอนแทนรายวัน"
                  subtitle={`ครูทุกคนที่ลา · ${printRangeLabel}`}
                  filename={`สอนแทน-${printRangeLabel}-ทุกคน`}
                  items={shareItemsForDay}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

function isSubstitutionComplete(period: {
  status: string;
  actionType: string;
  substitution: unknown | null;
}) {
  return period.status === "DONE" && period.actionType === "SUBSTITUTE" && Boolean(period.substitution);
}
