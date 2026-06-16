import Link from "next/link";
import { LogOut } from "lucide-react";
import type { SessionUser } from "@/lib/auth";

const links = [
  { href: "/dashboard", label: "ภาพรวม", roles: ["ADMIN", "PERSONNEL", "HEAD", "DEPT_REP", "TEACHER"] },
  { href: "/absences", label: "บันทึกการลา/ไปราชการ", roles: ["ADMIN", "PERSONNEL", "HEAD", "DEPT_REP", "TEACHER"] },
  { href: "/substitutions", label: "จัดสอนแทน", roles: ["ADMIN", "PERSONNEL", "HEAD", "DEPT_REP", "TEACHER"] },
  { href: "/swaps", label: "แลกคาบ", roles: ["ADMIN", "HEAD", "DEPT_REP", "TEACHER"] },
  { href: "/reports", label: "สถิติ", roles: ["ADMIN", "PERSONNEL", "HEAD"] },
  { href: "/data-upload", label: "อัพโหลดข้อมูล", roles: ["ADMIN", "HEAD"] },
  { href: "/users", label: "จัดการผู้ใช้", roles: ["ADMIN"] }
];

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/dashboard">
          <strong>จัดครูสอนแทน</strong>
          <span>{roleLabel(user.role)} · {user.username}</span>
        </Link>
        <nav className="nav" aria-label="เมนูหลัก">
          {links
            .filter((link) => link.roles.includes(user.role))
            .map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          <form action="/api/auth/logout" method="post">
            <button type="submit" title="ออกจากระบบ">
              <LogOut size={16} aria-hidden="true" /> ออก
            </button>
          </form>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}

function roleLabel(role: SessionUser["role"]) {
  if (role === "ADMIN") return "ผู้ดูแลระบบ";
  if (role === "PERSONNEL") return "หัวหน้างานบุคคล";
  if (role === "HEAD") return "หัวหน้ากลุ่มสาระ";
  if (role === "DEPT_REP") return "ตัวแทนกลุ่มสาระ";
  return "ครู";
}
