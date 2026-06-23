import Link from "next/link";
import { LogOut } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import type { PermissionKey } from "@/lib/permissions";
import { hasPermission, roleLabel } from "@/lib/permissions";

const links = [
  { href: "/dashboard", label: "ภาพรวม" },
  { href: "/absences", label: "บันทึกการลา/ไปราชการ", permissions: ["record_own_absence", "manage_all_absences"] },
  { href: "/substitutions", label: "จัดสอนแทน", permissions: ["manage_substitutions"] },
  { href: "/swaps", label: "แลกคาบ", permissions: ["manage_swaps"] },
  { href: "/reports", label: "สถิติ", permissions: ["view_reports"] },
  { href: "/data-upload", label: "อัพโหลดข้อมูล", permissions: ["manage_teacher_data", "import_schedules"] },
  { href: "/users", label: "จัดการผู้ใช้", adminOnly: true },
  { href: "/settings", label: "ตั้งค่าระบบ", adminOnly: true }
] satisfies {
  href: string;
  label: string;
  permissions?: PermissionKey[];
  adminOnly?: boolean;
}[];

export async function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const visibleLinks = [];
  for (const link of links) {
    const visible =
      !link.adminOnly &&
      (!link.permissions || (await Promise.all(link.permissions.map((permission) => hasPermission(user, permission)))).some(Boolean));
    if (user.role === "ADMIN" || visible) visibleLinks.push(link);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/dashboard">
          <strong>จัดครูสอนแทน</strong>
          <span>{roleLabel(user.role)} · {user.username}</span>
        </Link>
        <nav className="nav" aria-label="เมนูหลัก">
          {visibleLinks
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
