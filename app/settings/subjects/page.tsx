import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SubjectSettingsPage() {
  const user = await requireAdmin();
  const subjects = await prisma.subject.findMany({
    orderBy: [{ code: "asc" }, { name: "asc" }]
  });

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>ตั้งค่ารายวิชา</h1>
          <p className="muted">เลือกรายวิชาที่ต้องสร้างรายการจัดสอนแทนเมื่อครูลา/ไปราชการ</p>
        </div>
      </div>

      <section className="card">
        <form className="form" action="/api/subjects" method="post">
          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>รหัสวิชา</th>
                  <th>รายวิชา</th>
                  <th>ต้องจัดสอนแทน</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => (
                  <tr key={subject.id}>
                    <td>{subject.code || "-"}</td>
                    <td>{subject.name}</td>
                    <td>
                      <input type="hidden" name="subjectIds" value={subject.id} />
                      <label className="inline-check">
                        <input
                          type="checkbox"
                          name="requiresSubstitution"
                          value={subject.id}
                          defaultChecked={subject.requiresSubstitution}
                        />
                        <span>{subject.requiresSubstitution ? "จัดสอนแทน" : "ไม่ต้องจัดสอนแทน"}</span>
                      </label>
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
          <button className="btn primary" type="submit">
            บันทึกการตั้งค่า
          </button>
        </form>
      </section>
    </AppShell>
  );
}
