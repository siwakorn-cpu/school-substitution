import { requireAdmin } from "@/lib/auth";
import { MANAGED_ROLES, PERMISSIONS, setRolePermissions } from "@/lib/permissions";
import { redirectTo } from "@/lib/redirect";
import { logActivity } from "@/lib/auditLog";

export async function POST(request: Request) {
  const user = await requireAdmin();
  const formData = await request.formData();
  const permissionKeys = new Set(PERMISSIONS.map((permission) => permission.key));

  await Promise.all(
    MANAGED_ROLES.map((role) => {
      const enabled = new Set<string>();
      for (const permission of permissionKeys) {
        if (formData.get(`${role}:${permission}`) === "on") enabled.add(permission);
      }
      return setRolePermissions(role, enabled);
    })
  );

  await logActivity(user, "update", "RolePermission", null, "แก้ไขสิทธิ์การใช้งานตามบทบาท");

  return redirectTo(request, "/settings/permissions?saved=1");
}
