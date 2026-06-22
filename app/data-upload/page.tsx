import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { canImportSchedule, canManageTeacher } from "@/lib/rbac";

export default async function DataUploadPage() {
  const user = await requireUser();
  const [canManage, canImport] = await Promise.all([canManageTeacher(user), canImportSchedule(user)]);

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>อัพโหลดข้อมูล</h1>
          <p className="muted">เลือกหมวดข้อมูลที่ต้องการจัดการ</p>
        </div>
      </div>

      <section className="grid">
        {canManage ? (
          <div className="card span-6">
            <h2>ข้อมูลครู</h2>
            <p className="muted">นำเข้ารายชื่อครู เพิ่มครู แก้ไขครู และตั้งค่ากลุ่มสาระ</p>
            <div className="actions">
              <a className="btn primary" href="/data-upload/teachers">
                เปิดหน้าข้อมูลครู
              </a>
            </div>
          </div>
        ) : null}

        {canImport ? (
          <div className="card span-6">
            <h2>ตารางสอน</h2>
            <p className="muted">นำเข้าตารางสอน ดาวน์โหลดแบบฟอร์ม และแก้ไขคาบสอนรายคาบ</p>
            <div className="actions">
              <a className="btn primary" href="/data-upload/schedules">
                เปิดหน้าตารางสอน
              </a>
            </div>
          </div>
        ) : null}

        {!canManage && !canImport ? (
          <div className="card">
            <p className="error">บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูลนำเข้า</p>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
