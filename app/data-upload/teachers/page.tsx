import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeacher } from "@/lib/rbac";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export default async function TeacherDataPage({
  searchParams
}: {
  searchParams: Promise<{ teacherImported?: string; teacherError?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const canManage = await canManageTeacher(user);

  if (!canManage) {
    return (
      <AppShell user={user}>
        <p className="error">บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูลครู</p>
      </AppShell>
    );
  }

  const [teachers, departments] = await Promise.all([
    prisma.teacher.findMany({
      include: { department: true },
      orderBy: [{ status: "asc" }, { code: "asc" }]
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } })
  ]);

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>ข้อมูลครู</h1>
          <p className="muted">นำเข้า เพิ่ม แก้ไขรายชื่อครู และตั้งค่ากลุ่มสาระ</p>
        </div>
        <a className="btn" href="/data-upload">
          กลับอัพโหลดข้อมูล
        </a>
      </div>

      <section className="grid">
        <div className="card span-4">
          <h2>นำเข้ารายชื่อครู</h2>
          {params.teacherImported ? (
            <p className="badge success">นำเข้าครูสำเร็จ {params.teacherImported} รายการ</p>
          ) : null}
          {params.teacherError ? <p className="error">{decodeURIComponent(params.teacherError)}</p> : null}
          <form className="form" action="/api/teachers/import" method="post" encType="multipart/form-data">
            <label>
              ไฟล์รายชื่อครู Excel/CSV
              <input name="file" type="file" accept=".xlsx,.csv" required />
            </label>
            <button className="btn primary" type="submit">
              นำเข้าครู
            </button>
          </form>
        </div>

        <div className="card span-4">
          <h2>แบบฟอร์มรายชื่อครู</h2>
          <p className="muted">ใช้คอลัมน์ teacher_code, teacher_name, department และ status</p>
          <div className="actions">
            <a className="btn primary" href="/api/teachers/template?format=xlsx">
              ดาวน์โหลด Excel
            </a>
            <a className="btn" href="/api/teachers/template?format=csv">
              ดาวน์โหลด CSV
            </a>
          </div>
        </div>

        <div className="card span-4">
          <h2>เพิ่มครู</h2>
          <form className="form" action="/api/teachers" method="post">
            <input type="hidden" name="intent" value="create" />
            <label>
              รหัสครู
              <input name="code" required />
            </label>
            <label>
              ชื่อครู
              <input name="name" required />
            </label>
            <label>
              กลุ่มสาระ
              <select name="departmentId" required>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn primary" type="submit">
              เพิ่มครู
            </button>
          </form>
        </div>

        <div className="card span-4 teacher-compact-section">
          <h2>ตั้งค่ากลุ่มสาระ</h2>
          <form className="form" action="/api/departments" method="post">
            <input type="hidden" name="intent" value="create" />
            <div className="form-row">
              <label>
                ชื่อกลุ่มสาระใหม่
                <input name="name" placeholder="เช่น สุขศึกษาและพลศึกษา" required />
              </label>
              <div className="actions">
                <button className="btn primary" type="submit">
                  เพิ่มกลุ่มสาระ
                </button>
              </div>
            </div>
          </form>
          <div className="table-wrap">
            <table className="department-settings-table">
              <thead>
                <tr>
                  <th>ชื่อกลุ่มสาระ</th>
                  <th>จำนวนครู</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => (
                  <tr key={department.id}>
                    <td>{department.name}</td>
                    <td>{teachers.filter((teacher) => teacher.departmentId === department.id).length}</td>
                    <td>
                      <form className="actions compact-inline-form" action="/api/departments" method="post">
                        <input type="hidden" name="intent" value="update" />
                        <input type="hidden" name="id" value={department.id} />
                        <input name="name" defaultValue={department.name} aria-label="ชื่อกลุ่มสาระ" required />
                        <button className="btn" type="submit">
                          บันทึกชื่อ
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card teacher-compact-section">
          <h2>รายชื่อครู</h2>
          <div className="table-wrap">
            <table className="teacher-list-table">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่อ</th>
                  <th>กลุ่มสาระ</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td>{teacher.code}</td>
                    <td className="no-glossary">{teacher.name}</td>
                    <td>{teacher.department.name}</td>
                    <td>
                      <span className={`badge ${teacher.status === "ACTIVE" ? "success" : "danger"}`}>
                        {teacher.status === "ACTIVE" ? "ใช้งาน" : "ปิดใช้งาน"}
                      </span>
                    </td>
                    <td>
                      <div className="teacher-row-actions">
                        <details className="teacher-edit-toggle">
                          <summary>แก้ไข</summary>
                          <form className="teacher-edit-form" action="/api/teachers" method="post">
                            <input type="hidden" name="intent" value="update" />
                            <input type="hidden" name="id" value={teacher.id} />
                            <label>
                              รหัสครู
                              <input name="code" defaultValue={teacher.code} required />
                            </label>
                            <label>
                              ชื่อครู
                              <input name="name" defaultValue={teacher.name} required />
                            </label>
                            <label>
                              กลุ่มสาระ
                              <select name="departmentId" defaultValue={teacher.departmentId} aria-label="กลุ่มสาระ">
                                {departments.map((department) => (
                                  <option key={department.id} value={department.id}>
                                    {department.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              สถานะ
                              <select name="status" defaultValue={teacher.status} aria-label="สถานะ">
                                <option value="ACTIVE">ใช้งาน</option>
                                <option value="INACTIVE">ปิดใช้งาน</option>
                              </select>
                            </label>
                            <button className="btn primary" type="submit">
                              บันทึกแก้ไข
                            </button>
                          </form>
                        </details>
                        <form action="/api/teachers" method="post">
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="id" value={teacher.id} />
                          <ConfirmSubmitButton
                            className="btn danger"
                            message={`ยืนยันการลบครู ${teacher.name}? การลบไม่สามารถย้อนกลับได้`}
                          >
                            ลบครู
                          </ConfirmSubmitButton>
                        </form>
                      </div>
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
