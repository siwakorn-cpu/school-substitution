import { hashPassword, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: Request) {
  const currentUser = await requireAdmin();
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "create") {
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const teacherId = normalizeTeacherId(formData.get("teacherId"));

    if (username && password.length >= 6) {
      await prisma.user.create({
        data: {
          username,
          passwordHash: await hashPassword(password),
          role: normalizeRole(formData.get("role")),
          teacherId
        }
      });
    }
  }

  if (intent === "update") {
    const id = String(formData.get("id") ?? "");
    const password = String(formData.get("password") ?? "");
    const isSelf = id === currentUser.id;
    const isActive = String(formData.get("isActive") ?? "true") === "true";

    await prisma.user.update({
      where: { id },
      data: {
        role: normalizeRole(formData.get("role")),
        teacherId: normalizeTeacherId(formData.get("teacherId")),
        isActive: isSelf ? true : isActive,
        ...(password.length >= 6 ? { passwordHash: await hashPassword(password) } : {})
      }
    });
  }

  return redirectTo(request, "/users");
}

function normalizeRole(value: FormDataEntryValue | null) {
  const role = String(value ?? "TEACHER").trim();
  if (role === "ครู") return "TEACHER";
  if (role === "ADMIN" || role === "PERSONNEL" || role === "HEAD" || role === "DEPT_REP" || role === "TEACHER") {
    return role;
  }
  return "TEACHER";
}

function normalizeTeacherId(value: FormDataEntryValue | null) {
  const teacherId = String(value ?? "").trim();
  return teacherId || null;
}
