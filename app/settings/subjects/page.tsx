import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { thaiDays } from "@/lib/date";
import { SubjectSettingsForm } from "./SubjectSettingsForm";

const ACTIVITY_DAYS = [1, 2, 3, 4, 5];
const ACTIVITY_PERIODS = Array.from({ length: 10 }, (_, index) => index + 1);

function activityTypeLabel(type: string) {
  return type === "CLUB" ? "ชุมนุม" : "ลูกเสือ เนตรนารี ยุวกาชาด";
}

export default async function SubjectSettingsPage() {
  const user = await requireAdmin();
  const [subjects, activityPeriods] = await Promise.all([
    prisma.subject.findMany({ orderBy: [{ code: "asc" }, { name: "asc" }] }),
    prisma.activityPeriod.findMany({ orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }] })
  ]);

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
