import type { Role } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const MANAGED_ROLES = ["TEACHER", "PERSONNEL", "HEAD", "DEPT_REP"] as const satisfies readonly Role[];

export const PERMISSIONS = [
  {
    key: "record_own_absence",
    label: "บันทึกลา/ไปราชการของตนเอง",
    labelEn: "Record own absence / official duty",
    description: "ให้ผู้ใช้ที่ผูกกับครูบันทึกไปราชการหรือลากิจของตนเองได้",
    descriptionEn: "Allow linked teachers to record their own official duty or personal leave"
  },
  {
    key: "manage_all_absences",
    label: "บันทึกลา/ไปราชการให้ทุกคน",
    labelEn: "Record absence / official duty for everyone",
    description: "เลือกครูคนอื่นและบันทึกการลา/ไปราชการแทนได้",
    descriptionEn: "Select another teacher and record absence or official duty on their behalf"
  },
  {
    key: "manage_substitutions",
    label: "จัดครูสอนแทน",
    labelEn: "Manage substitutions",
    description: "เปิดหน้าจัดสอนแทนและเลือกครูเข้าแทนได้",
    descriptionEn: "Open the substitution page and assign substitute teachers"
  },
  {
    key: "manage_swaps",
    label: "จัดการแลกคาบ",
    labelEn: "Manage swaps",
    description: "เปิดหน้าแลกคาบและสร้างคำขอสลับคาบได้",
    descriptionEn: "Open the swap page and create period swap requests"
  },
  {
    key: "approve_schedule_changes",
    label: "อนุมัติการเปลี่ยนแปลงคาบ",
    labelEn: "Approve schedule changes",
    description: "อนุมัติ/ไม่อนุมัติรายการเข้าแทนหรือสลับคาบ",
    descriptionEn: "Approve or reject substitution and period swap requests"
  },
  {
    key: "view_reports",
    label: "ดู Dashboard สถิติ",
    labelEn: "View statistics dashboard",
    description: "ดูรายงานรวมและ export รายงาน",
    descriptionEn: "View combined reports and export report data"
  },
  {
    key: "export_teacher_substitution_image",
    label: "Export รูปสรุปสอนแทนรายครู",
    labelEn: "Export teacher substitution image",
    description: "สร้างรูปภาพสรุปสอนแทนรายครูเมื่อจัดคาบของครูคนนั้นครบแล้ว",
    descriptionEn: "Create a teacher-level substitution summary image after all periods are assigned"
  },
  {
    key: "export_department_substitution_image",
    label: "Export รูปสรุปสอนแทนรายกลุ่มสาระ",
    labelEn: "Export department substitution image",
    description: "สร้างรูปภาพสรุปสอนแทนของกลุ่มสาระเมื่อจัดคาบของกลุ่มสาระนั้นครบแล้ว",
    descriptionEn: "Create a department-level substitution summary image after all periods are assigned"
  },
  {
    key: "export_daily_substitution_image",
    label: "Export รูปสรุปสอนแทนรายวัน",
    labelEn: "Export daily substitution image",
    description: "สร้างรูปภาพสรุปสอนแทนครูทุกคนที่ลาในวันหรือช่วงวันที่เลือก",
    descriptionEn: "Create a daily substitution summary image for all absent teachers in the selected date range"
  },
  {
    key: "manage_teacher_data",
    label: "จัดการข้อมูลครู",
    labelEn: "Manage teacher data",
    description: "เพิ่ม แก้ไข นำเข้าครู และตั้งค่ากลุ่มสาระ",
    descriptionEn: "Add, edit, import teachers, and configure departments"
  },
  {
    key: "import_schedules",
    label: "จัดการตารางสอน",
    labelEn: "Manage teaching schedules",
    description: "นำเข้า แก้ไข และลบตารางสอน",
    descriptionEn: "Import, edit, and delete teaching schedules"
  }
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

const ADMIN_PERMISSIONS = new Set<PermissionKey>(PERMISSIONS.map((permission) => permission.key));

const DEFAULT_ROLE_PERMISSIONS: Record<(typeof MANAGED_ROLES)[number], PermissionKey[]> = {
  TEACHER: ["record_own_absence", "manage_swaps"],
  PERSONNEL: ["manage_all_absences", "manage_substitutions", "view_reports"],
  HEAD: [
    "manage_substitutions",
    "manage_swaps",
    "approve_schedule_changes",
    "view_reports",
    "export_teacher_substitution_image",
    "export_department_substitution_image"
  ],
  DEPT_REP: [
    "manage_substitutions",
    "manage_swaps",
    "approve_schedule_changes",
    "export_teacher_substitution_image",
    "export_department_substitution_image"
  ]
};

export function roleLabel(role: Role) {
  if (role === "ADMIN") return "ผู้ดูแลระบบ";
  if (role === "PERSONNEL") return "หัวหน้างานบุคคล";
  if (role === "HEAD") return "หัวหน้ากลุ่มสาระ";
  if (role === "DEPT_REP") return "ตัวแทนกลุ่มสาระ";
  return "ครู";
}

export function defaultPermissionEnabled(role: Role, permission: PermissionKey) {
  if (role === "ADMIN") return ADMIN_PERMISSIONS.has(permission);
  if (!isManagedRole(role)) return false;
  return DEFAULT_ROLE_PERMISSIONS[role].includes(permission);
}

export function isManagedRole(role: Role): role is (typeof MANAGED_ROLES)[number] {
  return MANAGED_ROLES.includes(role as (typeof MANAGED_ROLES)[number]);
}

export async function getRolePermissionMap(role: Role) {
  const rows = await prisma.rolePermission.findMany({ where: { role } });
  const stored = new Map(rows.map((row) => [row.permission, row.enabled]));

  return new Map(
    PERMISSIONS.map((permission) => [
      permission.key,
      stored.get(permission.key) ?? defaultPermissionEnabled(role, permission.key)
    ])
  );
}

export async function hasPermission(user: SessionUser, permission: PermissionKey) {
  if (user.role === "ADMIN") return true;
  const permissions = await getRolePermissionMap(user.role);
  return permissions.get(permission) ?? false;
}

export async function setRolePermissions(role: Role, enabledPermissions: Set<string>) {
  if (!isManagedRole(role)) return;

  await prisma.$transaction(
    PERMISSIONS.map((permission) =>
      prisma.rolePermission.upsert({
        where: { role_permission: { role, permission: permission.key } },
        create: { role, permission: permission.key, enabled: enabledPermissions.has(permission.key) },
        update: { enabled: enabledPermissions.has(permission.key) }
      })
    )
  );
}
