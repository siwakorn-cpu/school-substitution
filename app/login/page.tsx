import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; registered?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>เข้าสู่ระบบ</h1>
        <p className="muted">ระบบจัดครูสอนแทนและแลกคาบ</p>
        {params.registered ? <p className="badge success">ส่งคำขอลงทะเบียนแล้ว รอผู้ดูแลระบบอนุมัติ</p> : null}
        {params.error ? <p className="error">ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง</p> : null}
        <form className="form" action="/api/auth/login" method="post">
          <label>
            ชื่อผู้ใช้
            <input name="username" autoComplete="username" required />
          </label>
          <label>
            รหัสผ่าน
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="btn primary" type="submit">
            เข้าสู่ระบบ
          </button>
        </form>
        <p className="muted login-links">
          ยังไม่มีบัญชี <Link href="/register">ลงทะเบียน</Link>
        </p>
      </section>
    </main>
  );
}
