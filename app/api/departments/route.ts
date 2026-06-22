import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeacher } from "@/lib/rbac";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!(await canManageTeacher(user))) return redirectTo(request, "/dashboard");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (intent === "create" && name) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  if (intent === "update" && name) {
    await prisma.department.update({
      where: { id: String(formData.get("id") ?? "") },
      data: { name }
    });
  }

  return redirectTo(request, "/data-upload/teachers");
}
