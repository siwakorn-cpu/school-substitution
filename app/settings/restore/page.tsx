import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";
import { RestoreBackupFlow } from "./RestoreBackupFlow";

export default async function SettingsRestorePage() {
  const user = await requireAdmin();

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>กู้คืนข้อมูลจากไฟล์สำรอง</h1>
          <p className="muted">โหลดไฟล์ backup (.json) ที่ดาวน์โหลดไว้ กลับเข้าสู่ระบบ</p>
        </div>
        <a className="btn" href="/settings">
          กลับตั้งค่าระบบ
        </a>
      </div>

      <section className="grid">
        <div className="card span-8">
          <h2>กู้คืนข้อมูล</h2>
          <RestoreBackupFlow />
        </div>
        <div className="card span-4">
          <h2>ข้อควรระวัง</h2>
          <p className="muted">
            ใช้ได้เฉพาะไฟล์สำรองข้อมูลของระบบนี้ (formatVersion 1) เท่านั้น โหมด &quot;เติมเฉพาะข้อมูลที่ขาด&quot;
            จะไม่ทับข้อมูลเดิม ส่วนโหมด &quot;แทนที่ข้อมูลทั้งหมด&quot; จะล้างข้อมูลปัจจุบันก่อนโหลดใหม่และย้อนกลับไม่ได้
            ควรดาวน์โหลด backup ปัจจุบันก่อนทุกครั้ง
          </p>
        </div>
      </section>
    </AppShell>
  );
}
