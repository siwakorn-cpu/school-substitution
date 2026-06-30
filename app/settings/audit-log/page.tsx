import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDateInput, toDateInputValue } from "@/lib/date";

const ACTION_LABELS: Record<string, string> = {
  create: "เพิ่ม",
  update: "แก้ไข",
  delete: "ลบ",
  deactivate: "ปิดการใช้งาน",
  import: "นำเข้า",
  assign_substitute: "จัดครูสอนแทน",
  request_substitute: "ขอเข้าสอนแทน",
  approve_substitute: "อนุมัติเข้าสอนแทน",
  reject_substitute: "ปฏิเสธเข้าสอนแทน",
  cancel_substitute: "ยกเลิกเข้าสอนแทน",
  create_swap_request: "สร้างคำขอสลับคาบ",
  update_swap_request: "แก้ไขคำขอสลับคาบ",
  cancel_swap_request: "ยกเลิกคำขอสลับคาบ",
  approve_swap_request: "อนุมัติสลับคาบ",
  reject_swap_request: "ไม่อนุมัติสลับคาบ",
  system_reset: "เริ่มต้นระบบใหม่",
  restore_backup: "กู้คืนข้อมูล",
  start_new_term: "เริ่มภาคเรียนใหม่"
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function actionBadgeClass(action: string) {
  if (action.startsWith("delete") || action === "cancel_substitute" || action.startsWith("cancel") || action.startsWith("reject")) {
    return "danger";
  }
  if (action === "system_reset" || action === "restore_backup") return "warning";
  if (action.startsWith("create") || action === "import" || action.startsWith("approve") || action === "assign_substitute") {
    return "success";
  }
  return "";
}

export default async function AuditLogPage({
  searchParams
}: {
  searchParams: Promise<{ date?: string; username?: string }>;
}) {
  const user = await requireAdmin();
  const params = await searchParams;
  const username = (params.username ?? "").trim();
  const dateValue = params.date ?? "";

  const where: Prisma.AuditLogWhereInput = {};
  if (username) {
    where.username = { contains: username };
  }
  if (dateValue) {
    const start = parseDateInput(dateValue);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where.createdAt = { gte: start, lt: end };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300
  });

  return (
    <AppShell user={user}>
      <div className="compact-page">
      <div className="page-head">
        <div>
          <h1>ประวัติการใช้งาน</h1>
          <p className="muted">บันทึกการเพิ่ม/แก้ไข/ลบข้อมูลสำคัญในระบบ โดยใคร และเมื่อไหร่ (แสดงล่าสุด 300 รายการ)</p>
        </div>
      </div>

      <section className="grid">
        <div className="card span-12">
          <form className="compact-form" method="get">
            <label>
              วันที่
              <input type="date" name="date" defaultValue={dateValue} />
            </label>
            <label>
              ชื่อผู้ใช้
              <input type="text" name="username" placeholder="ค้นหาชื่อผู้ใช้" defaultValue={username} />
            </label>
            <button className="btn primary" type="submit">
              กรอง
            </button>
            <a className="btn" href="/settings/audit-log">
              ล้างตัวกรอง
            </a>
          </form>

          {logs.length === 0 ? (
            <p className="muted">ไม่พบรายการ</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>เวลา</th>
                    <th>ผู้ใช้</th>
                    <th>บทบาท</th>
                    <th>การกระทำ</th>
                    <th>ประเภทข้อมูล</th>
                    <th>รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(log.createdAt)}
                      </td>
                      <td className="no-glossary">{log.username}</td>
                      <td>{log.role}</td>
                      <td>
                        <span className={`badge ${actionBadgeClass(log.action)}`}>{actionLabel(log.action)}</span>
                      </td>
                      <td>{log.targetType}</td>
                      <td>{log.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      </div>
    </AppShell>
  );
}
