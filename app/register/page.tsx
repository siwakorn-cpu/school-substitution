import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;
  const teachers = await prisma.teacher.findMany({
    where: { status: "ACTIVE", user: null },
    include: { department: true },
    orderBy: { code: "asc" }
  });

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>ลงทะเบียน</h1>
        <p className="muted">สร้างบัญชีครูและรอผู้ดูแลระบบอนุมัติ</p>
        {params.error ? <p className="error">{registrationError(params.error)}</p> : null}
        <form className="form" action="/api/register" method="post">
          <label>
            ชื่อผู้ใช้
            <input name="username" autoComplete="username" required />
          </label>
          <label>
            รหัสผ่าน
            <input name="password" type="password" minLength={6} autoComplete="new-password" required />
          </label>
          <label>
            ยืนยันรหัสผ่าน
            <input name="confirmPassword" type="password" minLength={6} autoComplete="new-password" required />
          </label>
          <label>
            เชื่อมโยงกับครู
            <select name="teacherId" required>
              <option value="">เลือกครู</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.code} - {teacher.name} ({teacher.department.name})
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary" type="submit" disabled={teachers.length === 0}>
            ส่งคำขอลงทะเบียน
          </button>
        </form>
        {teachers.length === 0 ? <p className="error">ยังไม่มีครูที่สามารถผูกบัญชีใหม่ได้</p> : null}
        <p className="muted login-links">
          มีบัญชีแล้ว <Link href="/login">เข้าสู่ระบบ</Link>
        </p>
      </section>
    </main>
  );
}

function registrationError(error: string) {
  if (error === "password") return "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษรและยืนยันให้ตรงกัน";
  if (error === "username") return "ชื่อผู้ใช้นี้ถูกใช้แล้ว";
  if (error === "teacher") return "ครูที่เลือกถูกผูกกับบัญชีอื่นแล้ว";
  return "ไม่สามารถลงทะเบียนได้ กรุณาตรวจสอบข้อมูลอีกครั้ง";
}
