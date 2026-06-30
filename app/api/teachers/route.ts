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

  if (intent === "create") {
    const name = String(formData.get("name") ?? "").trim();
    const created = await prisma.teacher.create({
      data: {
        code: String(formData.get("code") ?? "").trim(),
        name,
        departmentId: String(formData.get("departmentId") ?? "")
      }
    });
    await logActivity(user, "create", "Teacher", created.id, `เพิ่มครู: ${name}`);
  }

  if (intent === "update") {
    const name = String(formData.get("name") ?? "").trim();
    const id = String(formData.get("id") ?? "");
    await prisma.teacher.update({
      where: { id },
      data: {
        code: String(formData.get("code") ?? "").trim(),
        name,
        departmentId: String(formData.get("departmentId") ?? ""),
        status: String(formData.get("status") ?? "ACTIVE") === "INACTIVE" ? "INACTIVE" : "ACTIVE"
      }
    });
    await logActivity(user, "update", "Teacher", id, `แก้ไขข้อมูลครู: ${name}`);
  }

  if (intent === "remove") {
    const id = String(formData.get("id") ?? "");
    const teacher = await prisma.teacher.update({
      where: { id },
      data: { status: "INACTIVE" }
    });
    await logActivity(user, "deactivate", "Teacher", id, `ปิดการใช้งานครู: ${teacher.name}`);
  }

  return redirectTo(request, "/data-upload/teachers");
}
