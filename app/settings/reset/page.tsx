import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";
import { ResetSystemFlow } from "./ResetSystemFlow";

export default async function SettingsResetPage() {
  const user = await requireAdmin();

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>เริ่มต้นระบบใหม่</h1>
          <p className="muted">สำรองข้อมูลก่อนรีเซ็ต และเลือกขอบเขตข้อมูลที่ต้องการล้าง</p>
        </div>
        <a className="btn" href="/settings">
          กลับตั้งค่าระบบ
        </a>
      </div>

      <section className="grid">
        <div className="card span-8">
          <h2>รีเซ็ตข้อมูลระบบ</h2>
          <ResetSystemFlow />
        </div>
        <div className="card span-4">
          <h2>ข้อควรระวัง</h2>
          <p className="muted">
            ควรดาวน์โหลด backup ทุกครั้งก่อนเริ่มต้นระบบใหม่ หากเลือกเริ่มใหม่ทั้งหมด ระบบจะเก็บเฉพาะบัญชีผู้ดูแลระบบไว้
          </p>
        </div>
      </section>
    </AppShell>
  );
}
