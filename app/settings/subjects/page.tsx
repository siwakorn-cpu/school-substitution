import { AppShell } from "@/components/AppShell";
import { SaveToast } from "@/components/SaveToast";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { thaiDays } from "@/lib/date";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { LevelMeetingForm } from "./LevelMeetingForm";
import { SubjectSettingsForm } from "./SubjectSettingsForm";

const ACTIVITY_DAYS = [1, 2, 3, 4, 5];
const ACTIVITY_PERIODS = Array.from({ length: 10 }, (_, index) => index + 1);
const LEVELS = [1, 2, 3, 4, 5, 6];

function activityTypeLabel(type: string) {
  return type === "CLUB" ? "ชุมนุม" : "ลูกเสือ เนตรนารี ยุวกาชาด";
}

export default async function SubjectSettingsPage({
  searchParams
}: {
  searchParams: Promise<{
    levelMeetingMessage?: string;
    levelMeetingError?: string;
    subjectMessage?: string;
    subjectError?: string;
  }>;
}) {
  const user = await requireAdmin();
  const params = await searchParams;
  const [subjects, activityPeriods, teachers, levelMeetings] = await Promise.all([
    prisma.subject.findMany({ orderBy: [{ code: "asc" }, { name: "asc" }] }),
    prisma.activityPeriod.findMany({ orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }] }),
    prisma.teacher.findMany({
      where: { status: "ACTIVE" },
      include: { department: true },
      orderBy: [{ department: { name: "asc" } }, { code: "asc" }, { name: "asc" }]
    }),
    prisma.levelMeeting.findMany({
      include: { teachers: { include: { teacher: { include: { department: true } } } } },
      orderBy: { level: "asc" }
    })
  ]);
  const meetingByLevel = new Map(levelMeetings.map((meeting) => [meeting.level, meeting]));
  const teacherOptions = teachers.map((teacher) => ({
    id: teacher.id,
    code: teacher.code,
    name: teacher.name,
    departmentName: teacher.department.name
  }));

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>ตั้งค่ารายวิชา</h1>
          <p className="muted">เลือกรายวิชาที่ต้องสร้างรายการจัดสอนแทนเมื่อครูลา/ไปราชการ</p>
        </div>
      </div>

      <section className="card">
        <h2>จัดการรายวิชา</h2>
        <span className="en-caption">Manage subjects</span>
        <p className="muted">เพิ่มหรือลบรายวิชา รายวิชาที่ยังมีตารางสอนใช้อยู่จะลบไม่ได้ ให้ลบคาบสอนที่ใช้รายวิชานั้นก่อน</p>

        {params.subjectMessage ? (
          <SaveToast message={decodeURIComponent(params.subjectMessage)} paramName="subjectMessage" />
        ) : null}
        {params.subjectError ? <p className="notice danger">{decodeURIComponent(params.subjectError)}</p> : null}

        <form className="form activity-add-form" action="/api/subjects" method="post">
          <input type="hidden" name="intent" value="create" />
          <label>
            รหัสวิชา
            <input name="code" placeholder="เช่น ค21101 (ไม่บังคับ)" autoComplete="off" />
          </label>
          <label>
            รายวิชา
            <input name="name" placeholder="ชื่อรายวิชา" required autoComplete="off" />
          </label>
          <label className="inline-check">
            <input type="checkbox" name="requiresSubstitution" defaultChecked />
            <span>ต้องจัดสอนแทน</span>
          </label>
          <button className="btn primary" type="submit">
            เพิ่มรายวิชา
          </button>
        </form>

        <div className="table-wrap">
          <table className="compact-table">
            <thead>
              <tr>
                <th>รหัสวิชา</th>
                <th>รายวิชา</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => (
                <tr key={subject.id}>
                  <td className="no-glossary">{subject.code || "-"}</td>
                  <td className="no-glossary">{subject.name}</td>
                  <td>
                    <div className="teacher-row-actions">
                      <details className="teacher-edit-toggle">
                        <summary>แก้ไข</summary>
                        <form className="teacher-edit-form" action="/api/subjects" method="post">
                          <input type="hidden" name="intent" value="update" />
                          <input type="hidden" name="id" value={subject.id} />
                          <label>
                            รหัสวิชา
                            <input name="code" defaultValue={subject.code ?? ""} autoComplete="off" />
                          </label>
                          <label>
                            รายวิชา
                            <input name="name" defaultValue={subject.name} required autoComplete="off" />
                          </label>
                          <label className="inline-check">
                            <input
                              type="checkbox"
                              name="requiresSubstitution"
                              defaultChecked={subject.requiresSubstitution}
                            />
                            <span>ต้องจัดสอนแทน</span>
                          </label>
                          <button className="btn primary" type="submit">
                            บันทึกแก้ไข
                          </button>
                        </form>
                      </details>
                      <form action="/api/subjects" method="post">
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={subject.id} />
                        <ConfirmSubmitButton
                          className="btn danger"
                          message={`ยืนยันการลบรายวิชา ${subject.name}? การลบไม่สามารถย้อนกลับได้`}
                        >
                          ลบ
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {subjects.length === 0 ? (
                <tr>
                  <td colSpan={3}>ยังไม่มีข้อมูลรายวิชา</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <SubjectSettingsForm subjects={subjects} />
      </section>

      <section className="card">
        <h2>คาบประชุมระดับ</h2>
        <span className="en-caption">Level meeting periods</span>
        <p className="muted">
          กำหนดประชุมระดับ ม.1-6 และเลือกครูผู้เข้าสอนหลายคนได้ในรอบเดียว ระบบจะสร้างคาบสอนในตารางครูโดยอัตโนมัติ
          คาบนี้ไม่ถูกใช้แลกคาบ/สลับคาบ และไม่ต้องจัดสอนแทนเมื่อครูไม่มาปฏิบัติงาน ลากิจ หรือไปราชการ
        </p>

        {params.levelMeetingMessage ? (
          <SaveToast message={params.levelMeetingMessage} paramName="levelMeetingMessage" />
        ) : null}
        {params.levelMeetingError ? <p className="notice danger">{params.levelMeetingError}</p> : null}

        <div className="level-meeting-grid">
          {LEVELS.map((level) => {
            const meeting = meetingByLevel.get(level);
            return (
              <LevelMeetingForm
                key={level}
                level={level}
                dayOfWeek={meeting?.dayOfWeek ?? 1}
                period={meeting?.period ?? 1}
                teacherIds={meeting?.teachers.map((assignment) => assignment.teacherId) ?? []}
                teachers={teacherOptions}
                isConfigured={Boolean(meeting)}
              />
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>คาบกิจกรรม (ชุมนุม / ลูกเสือ)</h2>
        <p className="muted">
          กำหนดว่าวันและคาบใดเป็นคาบชุมนุมหรือลูกเสือ คาบชุมนุมจะแสดงในตารางของครูทุกคน ส่วนคาบลูกเสือจะแสดงรายวิชาเดิมถ้าครูมีสอนคาบนั้น
          มิฉะนั้นแสดง &quot;ลูกเสือ เนตรนารี ยุวกาชาด&quot; ทั้งสองประเภทแลกคาบไม่ได้
        </p>

        <form className="form activity-add-form" action="/api/activity-periods" method="post">
          <input type="hidden" name="intent" value="create" />
          <label>
            วัน
            <select name="dayOfWeek" defaultValue="3">
              {ACTIVITY_DAYS.map((day) => (
                <option key={day} value={day}>
                  {thaiDays[day]}
                </option>
              ))}
            </select>
          </label>
          <label>
            คาบ
            <select name="period" defaultValue="8">
              {ACTIVITY_PERIODS.map((period) => (
                <option key={period} value={period}>
                  คาบ {period}
                </option>
              ))}
            </select>
          </label>
          <label>
            ประเภท
            <select name="type" defaultValue="CLUB">
              <option value="CLUB">ชุมนุม</option>
              <option value="SCOUT">ลูกเสือ เนตรนารี ยุวกาชาด</option>
            </select>
          </label>
          <button className="btn primary" type="submit">
            เพิ่มคาบกิจกรรม
          </button>
        </form>

        <div className="table-wrap">
          <table className="compact-table">
            <thead>
              <tr>
                <th>วัน</th>
                <th>คาบ</th>
                <th>ประเภท</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {activityPeriods.map((activity) => (
                <tr key={activity.id}>
                  <td>{thaiDays[activity.dayOfWeek]}</td>
                  <td>คาบ {activity.period}</td>
                  <td>{activityTypeLabel(activity.type)}</td>
                  <td>
                    <form action="/api/activity-periods" method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={activity.id} />
                      <button className="btn danger" type="submit">
                        ลบ
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {activityPeriods.length === 0 ? (
                <tr>
                  <td colSpan={4}>ยังไม่ได้กำหนดคาบกิจกรรม</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
