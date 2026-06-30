import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeacher } from "@/lib/rbac";
import { redirectTo } from "@/lib/redirect";
import { logActivity } from "@/lib/auditLog";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!(await canManageTeacher(user))) return redirectTo(request, "/dashboard");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (intent === "create" && name) {
    const department = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name }
    });
    await logActivity(user, "create", "Department", department.id, `เพิ่มกลุ่มสาระ: ${name}`);
  }

  if (intent === "update" && name) {
    const id = String(formData.get("id") ?? "");
    await prisma.department.update({
      where: { id },
      data: { name }
    });
    await logActivity(user, "update", "Department", id, `แก้ไขกลุ่มสาระ: ${name}`);
  }

  return redirectTo(request, "/data-upload/teachers");
}
