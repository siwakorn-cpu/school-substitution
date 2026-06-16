import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function UsersPage({
  searchParams
}: {
  searchParams: Promise<{ imported?: string; error?: string }>;
}) {
  const user = await requireAdmin();
  const params = await searchParams;
  const [users, teachers] = await Promise.all([
    prisma.user.findMany({
      include: { teacher: { include: { department: true } } },
      orderBy: [{ role: "asc" }, { username: "asc" }]
    }),
    prisma.teacher.findMany({
      where: { status: "ACTIVE" },
      include: { department: true, user: true },
      orderBy: { code: "asc" }
    })
  ]);

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>จัดการผู้ใช้</h1>
          <p className="muted">สร้างบัญชีเข้าสู่ระบบ ตั้งสิทธิ์ตามหน้าที่ และเปิดปิดการใช้งาน</p>
        </div>
      </div>

      <section className="grid">
        <div className="card span-4">
          <h2>นำเข้าผู้ใช้หลายคน</h2>
          {params.imported ? <p className="badge success">นำเข้าผู้ใช้สำเร็จ {params.imported} รายการ</p> : null}
          {params.error ? <p className="error">{decodeURIComponent(params.error)}</p> : null}
          <form className="form" action="/api/users/import" method="post" encType="multipart/form-data">
            <label>
              ไฟล์ผู้ใช้ Excel/CSV
              <input name="file" type="file" accept=".xlsx,.csv" required />
            </label>
            <button className="btn primary" type="submit">
              นำเข้าผู้ใช้
            </button>
          </form>
        </div>

        <div className="card span-4">
          <h2>แบบฟอร์มผู้ใช้</h2>
          <p className="muted">ใช้คอลัมน์ username, password, role, teacher_code และ is_active</p>
          <div className="actions">
            <a className="btn primary" href="/api/users/template?format=xlsx">
              ดาวน์โหลด Excel
            </a>
            <a className="btn" href="/api/users/template?format=csv">
              ดาวน์โหลด CSV
            </a>
          </div>
        </div>

        <div className="card span-4">
          <h2>เพิ่มผู้ใช้</h2>
          <form className="form" action="/api/users" method="post">
            <input type="hidden" name="intent" value="create" />
            <label>
              ชื่อผู้ใช้
              <input name="username" required />
            </label>
            <label>
              รหัสผ่านเริ่มต้น
              <input name="password" type="password" minLength={6} required />
            </label>
            <label>
              สิทธิ์
              <select name="role" defaultValue="TEACHER">
                <option value="ADMIN">Admin</option>
                <option value="PERSONNEL">หัวหน้างานบุคคล</option>
                <option value="HEAD">หัวหน้ากลุ่มสาระ</option>
                <option value="DEPT_REP">ตัวแทนกลุ่มสาระ</option>
                <option value="TEACHER">ครู</option>
              </select>
            </label>
            <label>
              ผูกกับครู
              <select name="teacherId" defaultValue="">
                <option value="">ไม่ผูกกับครู</option>
                {teachers
                  .filter((teacher) => !teacher.user)
                  .map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.code} - {teacher.name} ({teacher.department.name})
                    </option>
                  ))}
              </select>
            </label>
            <button className="btn primary" type="submit">
              เพิ่มผู้ใช้
            </button>
          </form>
        </div>

        <div className="card span-8">
          <h2>บัญชีผู้ใช้</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ชื่อผู้ใช้</th>
                  <th>สิทธิ์</th>
                  <th>ครูที่ผูก</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id}>
                    <td>{item.username}</td>
                    <td>{roleLabel(item.role)}</td>
                    <td>
                      {item.teacher
                        ? `${item.teacher.code} - ${item.teacher.name} (${item.teacher.department.name})`
                        : "-"}
                    </td>
                    <td>
                      <span className={`badge ${item.isActive ? "success" : "danger"}`}>
                        {item.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                      </span>
                    </td>
                    <td>
                      <form className="actions" action="/api/users" method="post">
                        <input type="hidden" name="intent" value="update" />
                        <input type="hidden" name="id" value={item.id} />
                        <select name="role" defaultValue={item.role} aria-label="สิทธิ์">
                          <option value="ADMIN">Admin</option>
                          <option value="PERSONNEL">หัวหน้างานบุคคล</option>
                          <option value="HEAD">หัวหน้ากลุ่มสาระ</option>
                          <option value="DEPT_REP">ตัวแทนกลุ่มสาระ</option>
                          <option value="TEACHER">ครู</option>
                        </select>
                        <select name="teacherId" defaultValue={item.teacherId ?? ""} aria-label="ครูที่ผูก">
                          <option value="">ไม่ผูกกับครู</option>
                          {teachers
                            .filter((teacher) => !teacher.user || teacher.id === item.teacherId)
                            .map((teacher) => (
                              <option key={teacher.id} value={teacher.id}>
                                {teacher.code} - {teacher.name}
                              </option>
                            ))}
                        </select>
                        <select name="isActive" defaultValue={item.isActive ? "true" : "false"} aria-label="สถานะ">
                          <option value="true">ใช้งาน</option>
                          <option value="false">ปิดใช้งาน</option>
                        </select>
                        <input name="password" type="password" placeholder="รหัสใหม่ ถ้าต้องการ" aria-label="รหัสผ่านใหม่" />
                        <button className="btn" type="submit">
                          บันทึก
                        </button>
                      </form>
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

function roleLabel(role: string) {
  if (role === "ADMIN") return "Admin";
  if (role === "PERSONNEL") return "หัวหน้างานบุคคล";
  if (role === "HEAD") return "หัวหน้ากลุ่มสาระ";
  if (role === "DEPT_REP") return "ตัวแทนกลุ่มสาระ";
  return "ครู";
}
