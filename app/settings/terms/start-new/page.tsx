import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";
import { getTermOptions } from "@/lib/terms";
import { NewTermFlow } from "@/app/terms/start-new/NewTermFlow";

export default async function SettingsStartNewTermPage() {
  const user = await requireAdmin();
  const termData = await getTermOptions();

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>เริ่มภาคเรียนใหม่</h1>
          <p className="muted">สำรองข้อมูลก่อนสร้างภาคเรียนใหม่ และเลือกว่าจะคัดลอกตารางสอนหรือเริ่มจากตารางว่าง</p>
        </div>
        <a className="btn" href="/settings">
          กลับตั้งค่าระบบ
        </a>
      </div>

      <section className="grid">
        <div className="card span-8">
          <h2>ตั้งค่าภาคเรียนใหม่</h2>
          <NewTermFlow terms={termData.terms} currentTerm={termData.currentTerm} />
        </div>
        <div className="card span-4">
          <h2>ภาคเรียนปัจจุบัน</h2>
          <p className="stat">
            <strong>{termData.currentTerm}</strong>
          </p>
          <p className="muted">ระบบจะเปลี่ยนค่าเริ่มต้นเป็นภาคเรียนใหม่หลังยืนยันเท่านั้น</p>
        </div>
      </section>
    </AppShell>
  );
}
