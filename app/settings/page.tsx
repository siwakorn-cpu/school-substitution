import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";

const settingsLinks = [
  {
    href: "/users",
    title: "จัดการผู้ใช้",
    titleEn: "Manage users",
    description: "อนุมัติบัญชีผู้ใช้ ผูกบัญชีกับครู และกำหนดบทบาทผู้ใช้งาน",
    descriptionEn: "Approve user accounts, link teachers, and assign user roles"
  },
  {
    href: "/settings/permissions",
    title: "ปรับสิทธิ์",
    titleEn: "Permissions",
    description: "กำหนดสิทธิ์ของครู หัวหน้างานบุคคล หัวหน้ากลุ่มสาระ และตัวแทนกลุ่มสาระ",
    descriptionEn: "Configure permissions for teachers, personnel heads, department heads, and department representatives"
  },
  {
    href: "/settings/terms/start-new",
    title: "เริ่มภาคเรียนใหม่",
    titleEn: "Start new term",
    description: "สำรองข้อมูลก่อนสร้างภาคเรียนใหม่ และเลือกว่าจะคัดลอกตารางสอนหรือเริ่มจากตารางว่าง",
    descriptionEn: "Back up data before creating a new term, then choose whether to copy schedules or start blank"
  },
  {
    href: "/settings/reset",
    title: "เริ่มต้นระบบใหม่",
    titleEn: "Restart system use",
    description: "รีเซ็ตข้อมูลการใช้งานหลังสำรองข้อมูลและยืนยันด้วย RESET",
    descriptionEn: "Reset system data after backup and RESET confirmation"
  },
  {
    href: "/settings/backup",
    title: "สำรองข้อมูล",
    titleEn: "Back up data",
    description: "ดาวน์โหลดข้อมูลทั้งระบบเป็นไฟล์ JSON ไฟล์เดียว เก็บไว้กู้คืนภายหลัง",
    descriptionEn: "Download the whole system as a single JSON file for later restore"
  },
  {
    href: "/settings/restore",
    title: "กู้คืนข้อมูล",
    titleEn: "Restore from backup",
    description: "โหลดไฟล์สำรองข้อมูล (.json) กลับเข้าระบบ แบบเติมส่วนที่ขาดหรือแทนที่ทั้งหมด",
    descriptionEn: "Load a backup (.json) file back into the system, either merging or replacing all data"
  },
  {
    href: "/settings/subjects",
    title: "ตั้งค่ารายวิชา",
    titleEn: "Subject settings",
    description: "กำหนดรายวิชาที่ต้องจัดสอนแทน หรือไม่ต้องสร้างรายการสอนแทน",
    descriptionEn: "Choose which subjects require substitution records"
  },
  {
    href: "/settings/audit-log",
    title: "ประวัติการใช้งาน",
    titleEn: "Activity log",
    description: "ดูว่ามีการเพิ่ม/แก้ไข/ลบข้อมูลอะไรบ้าง โดยใคร และเมื่อไหร่",
    descriptionEn: "See what data was added, changed, or deleted, by whom, and when"
  }
];

export default async function SettingsPage() {
  const user = await requireAdmin();

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>ตั้งค่าระบบ</h1>
          <p className="muted">รวมเมนูดูแลระบบที่มีผลกับสิทธิ์ ภาคเรียน และการเริ่มต้นใช้งานใหม่</p>
        </div>
      </div>

      <section className="grid">
        {settingsLinks.map((item) => (
          <a className="card span-4 settings-card" href={item.href} key={item.href} data-bilingual-processed="true">
            <h2>
              <span>{item.title}</span>
              <span className="en-caption">{item.titleEn}</span>
            </h2>
            <p className="muted">
              <span>{item.description}</span>
              <span className="en-caption">{item.descriptionEn}</span>
            </p>
          </a>
        ))}
      </section>
    </AppShell>
  );
}
