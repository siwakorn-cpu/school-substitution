import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageSubstitution } from "@/lib/rbac";
import { formatThaiDate, parseDateInput, toDateInputValue } from "@/lib/date";
import { recommendSubstitutes } from "@/lib/recommendSubstitutes";
import { getDepartmentScopeId, roleUsesDepartmentScope } from "@/lib/departmentScope";
import { ShareSubstitutionImage } from "@/components/ShareSubstitutionImage";

export default async function SubstitutionsPage({
  searchParams
}: {
  searchParams: Promise<{
    absencePeriodId?: string;
    edit?: string;
    sortDate?: string;
    dateScope?: string;
    departmentId?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const canAssignSubstitution = await canManageSubstitution(user);
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
  const recommendations =
    selected && canAssignSubstitution
      ? await recommendSubstitutes(selected.id, { departmentId: usesDepartmentScope ? departmentScopeId : null })
      : [];
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
                  {currentSubstitute ? (
                    <ShareSubstitutionImage
                      date={formatThaiDate(selected.absence.date)}
                      period={selected.period}
                      classRoom={selected.schedule.classRoom.name}
                      subject={selected.schedule.subject.name}
                      originalTeacher={`${selected.absence.teacher.name} (${selected.absence.teacher.department.name})`}
                      substituteTeacher={`${currentSubstitute.code} - ${currentSubstitute.name} (${currentSubstitute.department.name})`}
                      specialRoom={selected.schedule.specialRoom?.name ?? null}
                      note={selected.substitution.note}
                    />
                  ) : null}
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
                        <strong className="no-glossary">
                          {item.teacherCode} - {item.teacherName}
                        </strong>
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
      </section>
    </AppShell>
  );
}
