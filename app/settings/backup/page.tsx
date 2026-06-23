import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";
import { BackupDownload } from "./BackupDownload";

export default async function SettingsBackupPage() {
  const user = await requireAdmin();

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>สำรองข้อมูล</h1>
          <p className="muted">ดาวน์โหลดไฟล์สำรองข้อมูลทั้งระบบไว้กู้คืนภายหลัง</p>
        </div>
        <a className="btn" href="/settings">
          กลับตั้งค่าระบบ
        </a>
      </div>

      <section className="grid">
        <div className="card span-8">
          <h2>ดาวน์โหลดไฟล์สำรองข้อมูล</h2>
          <BackupDownload />
        </div>
        <div className="card span-4">
          <h2>ข้อควรระวัง</h2>
          <p className="muted">
            ไฟล์สำรองข้อมูลมีรหัสผ่านผู้ใช้ (แบบเข้ารหัส) เป็นข้อมูลอ่อนไหว ควรเก็บในที่ปลอดภัย ไม่อัปโหลดขึ้นที่สาธารณะ
            หากต้องการกู้คืน ให้ใช้เมนู &quot;กู้คืนข้อมูล&quot;
          </p>
        </div>
      </section>
    </AppShell>
  );
}
