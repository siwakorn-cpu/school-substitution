import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";

const settingsLinks = [
  {
    href: "/settings/permissions",
    title: "ปรับสิทธิ์",
    description: "กำหนดสิทธิ์ของครู หัวหน้างานบุคคล หัวหน้ากลุ่มสาระ และตัวแทนกลุ่มสาระ"
  },
  {
    href: "/settings/terms/start-new",
    title: "เริ่มภาคเรียนใหม่",
    description: "สำรองข้อมูลก่อนสร้างภาคเรียนใหม่ และเลือกว่าจะคัดลอกตารางสอนหรือเริ่มจากตารางว่าง"
  },
  {
    href: "/settings/reset",
    title: "เริ่มต้นระบบใหม่",
    description: "รีเซ็ตข้อมูลการใช้งานหลังสำรองข้อมูลและยืนยันด้วย RESET"
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
          <a className="card span-4 settings-card" href={item.href} key={item.href}>
            <h2>{item.title}</h2>
            <p className="muted">{item.description}</p>
          </a>
        ))}
      </section>
    </AppShell>
  );
}
