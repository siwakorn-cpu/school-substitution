import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatThaiDate } from "@/lib/date";
import { recommendSubstitutes } from "@/lib/recommendSubstitutes";

export default async function SubstitutionsPage({
  searchParams
}: {
  searchParams: Promise<{ absencePeriodId?: string; edit?: string; sortDate?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const absencePeriodId = params.absencePeriodId ?? "";
  const isEditing = params.edit === "1";
  const sortDate = params.sortDate === "asc" ? "asc" : "desc";

  const pendingPeriods = await prisma.absencePeriod.findMany({
    where: user.role === "TEACHER" ? { substitution: { substituteTeacherId: user.teacherId ?? "" } } : {},
    include: {
      absence: { include: { teacher: true } },
      schedule: { include: { classRoom: true, subject: true, specialRoom: true } },
      substitution: true
    },
    orderBy: [{ absence: { date: sortDate } }, { period: "asc" }],
    take: 50
  });

  const selected = absencePeriodId
    ? await prisma.absencePeriod.findUnique({
        where: { id: absencePeriodId },
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
  const recommendations = selected && user.role !== "TEACHER" ? await recommendSubstitutes(selected.id) : [];

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
              เรียงตามวันที่
              <select name="sortDate" defaultValue={sortDate}>
                <option value="desc">ล่าสุดก่อน</option>
                <option value="asc">เก่าก่อน</option>
              </select>
            </label>
            <button className="btn" type="submit">
              เรียงลำดับ
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
                      <a href={`/substitutions?absencePeriodId=${period.id}&sortDate=${sortDate}`}>
                        {formatThaiDate(period.absence.date)}
                      </a>
                    </td>
                    <td>{period.absence.teacher.name}</td>
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
                ครูเดิม: {selected.absence.teacher.name} ({selected.absence.teacher.department.name})
                {selected.schedule.specialRoom ? ` · ห้องพิเศษ: ${selected.schedule.specialRoom.name}` : ""}
              </p>

              {selected.substitution && !isEditing ? (
                <div className="recommendation-list">
                  <div className="recommendation-item">
                    <div className="recommendation-main">
                      <strong>จัดครูสอนแทนแล้ว</strong>
                      <p className="muted">
                        ครูสอนแทนปัจจุบัน:{" "}
                        {currentSubstitute
                          ? `${currentSubstitute.code} - ${currentSubstitute.name} (${currentSubstitute.department.name})`
                          : "ไม่พบข้อมูลครู"}
                      </p>
                    </div>
                    {user.role !== "TEACHER" ? (
                      <a className="btn primary" href={`/substitutions?absencePeriodId=${selected.id}&edit=1&sortDate=${sortDate}`}>
                        แก้ไขการจัดสอนแทน
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : user.role === "TEACHER" ? (
                <p className="muted">บัญชีครูดูรายการของตนเองได้ แต่จัดครูแทนไม่ได้</p>
              ) : recommendations.length === 0 ? (
                <p className="error">ยังไม่พบครูที่ผ่านเงื่อนไขในคาบนี้</p>
              ) : (
                <div className="recommendation-list">
                  {selected.substitution && isEditing ? (
                    <div className="actions">
                      <span className="badge warning">กำลังแก้ไขการจัดสอนแทน</span>
                      <a className="btn" href={`/substitutions?absencePeriodId=${selected.id}&sortDate=${sortDate}`}>
                        ยกเลิก
                      </a>
                    </div>
                  ) : null}
                  {recommendations.map((item) => (
                    <div className="recommendation-item" key={item.teacherId}>
                      <div className="recommendation-main">
                        <strong>
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
