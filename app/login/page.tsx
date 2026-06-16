import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>เข้าสู่ระบบ</h1>
        <p className="muted">ระบบจัดครูสอนแทนและแลกคาบ</p>
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
        <p className="muted">ทดลองใช้: admin / admin1234</p>
      </section>
    </main>
  );
}
