import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { thaiDays } from "@/lib/date";
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
  searchParams: Promise<{ levelMeetingMessage?: string; levelMeetingError?: string }>;
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

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>ตั้งค่ารายวิชา</h1>
          <p className="muted">เลือกรายวิชาที่ต้องสร้างรายการจัดสอนแทนเมื่อครูลา/ไปราชการ</p>
        </div>
      </div>

      <section className="card">
        <SubjectSettingsForm subjects={subjects} />
      </section>

      <section className="card">
        <h2>คาบประชุมระดับ</h2>
        <span className="en-caption">Level meeting periods</span>
        <p className="muted">
          กำหนดประชุมระดับ ม.1-6 และเลือกครูผู้เข้าสอนหลายคนได้ในรอบเดียว ระบบจะสร้างคาบสอนในตารางครูโดยอัตโนมัติ
          คาบนี้ไม่ถูกใช้แลกคาบ/สลับคาบ และไม่ต้องจัดสอนแทนเมื่อครูลาป่วย ลากิจ หรือไปราชการ
        </p>

        {params.levelMeetingMessage ? <p className="notice success">{params.levelMeetingMessage}</p> : null}
        {params.levelMeetingError ? <p className="notice danger">{params.levelMeetingError}</p> : null}

        <div className="level-meeting-grid">
          {LEVELS.map((level) => {
            const meeting = meetingByLevel.get(level);
            const selectedTeacherIds = new Set(meeting?.teachers.map((assignment) => assignment.teacherId) ?? []);
            return (
              <form key={level} className="level-meeting-form" action="/api/level-meetings" method="post">
                <input type="hidden" name="level" value={level} />
                <div className="level-meeting-head">
                  <div>
                    <h3>ประชุมระดับ ม.{level}</h3>
                    <span className="en-caption">Mathayom {level} level meeting</span>
                  </div>
                  {meeting ? (
                    <span className="badge">
                      {thaiDays[meeting.dayOfWeek]} คาบ {meeting.period}
                    </span>
                  ) : (
                    <span className="badge warning">ยังไม่ตั้งค่า</span>
                  )}
                </div>

                <div className="level-meeting-controls">
                  <label>
                    วัน
                    <select name="dayOfWeek" defaultValue={meeting?.dayOfWeek ?? 1}>
                      {ACTIVITY_DAYS.map((day) => (
                        <option key={day} value={day}>
                          {thaiDays[day]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    คาบ
                    <select name="period" defaultValue={meeting?.period ?? 1}>
                      {ACTIVITY_PERIODS.map((period) => (
                        <option key={period} value={period}>
                          คาบ {period}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <p className="small-label">ครูที่เข้าสอนคาบประชุมระดับ</p>
                  <span className="en-caption">Assigned teachers</span>
                  <div className="checkbox-grid level-teacher-grid">
                    {teachers.map((teacher) => (
                      <label key={teacher.id} className="compact-check">
                        <input
                          type="checkbox"
                          name="teacherIds"
                          value={teacher.id}
                          defaultChecked={selectedTeacherIds.has(teacher.id)}
                        />
                        <span>
                          {teacher.code} - {teacher.name}
                          <small>{teacher.department.name}</small>
                        </span>
                      </label>
                    ))}
                    {teachers.length === 0 ? <p className="muted">ยังไม่มีข้อมูลครู</p> : null}
                  </div>
                </div>

                <button className="btn primary no-glossary" type="submit">
                  <span>บันทึก ม.{level}</span>
                  <span className="en-caption">Save M.{level}</span>
                </button>
              </form>
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
