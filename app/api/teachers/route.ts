import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeacher } from "@/lib/rbac";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!(await canManageTeacher(user))) return redirectTo(request, "/dashboard");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "create") {
    await prisma.teacher.create({
      data: {
        code: String(formData.get("code") ?? "").trim(),
        name: String(formData.get("name") ?? "").trim(),
        departmentId: String(formData.get("departmentId") ?? "")
      }
    });
  }

  if (intent === "update") {
    await prisma.teacher.update({
      where: { id: String(formData.get("id") ?? "") },
      data: {
        code: String(formData.get("code") ?? "").trim(),
        name: String(formData.get("name") ?? "").trim(),
        departmentId: String(formData.get("departmentId") ?? ""),
        status: String(formData.get("status") ?? "ACTIVE") === "INACTIVE" ? "INACTIVE" : "ACTIVE"
      }
    });
  }

  if (intent === "remove") {
    await prisma.teacher.update({
      where: { id: String(formData.get("id") ?? "") },
      data: { status: "INACTIVE" }
    });
  }

  return redirectTo(request, "/data-upload/teachers");
}
