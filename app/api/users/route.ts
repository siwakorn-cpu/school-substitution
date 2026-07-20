import { hashPassword, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";
import { logActivity } from "@/lib/auditLog";

export async function POST(request: Request) {
  const currentUser = await requireAdmin();
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const redirectWithError = (message: string) => redirectTo(request, `/users?error=${encodeURIComponent(message)}`);
  const redirectSaved = (message: string) =>
    redirectTo(request, `/users?savedMessage=${encodeURIComponent(message)}`);

  if (intent === "create") {
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const teacherId = normalizeTeacherId(formData.get("teacherId"));

    if (username && password.length >= 6) {
      const created = await prisma.user.create({
        data: {
          username,
          passwordHash: await hashPassword(password),
          role: normalizeRole(formData.get("role")),
          teacherId
        }
      });
      await logActivity(currentUser, "create", "User", created.id, `เพิ่มผู้ใช้: ${username}`);
      return redirectSaved(`เพิ่มผู้ใช้ ${username} เรียบร้อยแล้ว`);
    }
  }

  if (intent === "update") {
    const id = String(formData.get("id") ?? "");
    const password = String(formData.get("password") ?? "");
    const isSelf = id === currentUser.id;
    const isActive = String(formData.get("isActive") ?? "true") === "true";
    const passwordChanged = password.length >= 6;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        role: normalizeRole(formData.get("role")),
        teacherId: normalizeTeacherId(formData.get("teacherId")),
        isActive: isSelf ? true : isActive,
        ...(passwordChanged ? { passwordHash: await hashPassword(password) } : {})
      }
    });
    await logActivity(currentUser, "update", "User", id, `แก้ไขผู้ใช้: ${updated.username}`);
    return redirectSaved(
      passwordChanged
        ? `บันทึกผู้ใช้ ${updated.username} และตั้งรหัสผ่านใหม่เรียบร้อยแล้ว`
        : `บันทึกผู้ใช้ ${updated.username} เรียบร้อยแล้ว`
    );
  }

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "");
    if (!id) return redirectWithError("ไม่พบผู้ใช้ที่ต้องการลบ");
    if (id === currentUser.id) return redirectWithError("ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่");

    try {
      const deleted = await prisma.user.delete({ where: { id } });
      await logActivity(currentUser, "delete", "User", id, `ลบผู้ใช้: ${deleted.username}`);
      return redirectSaved(`ลบผู้ใช้ ${deleted.username} เรียบร้อยแล้ว`);
    } catch {
      return redirectWithError("ลบผู้ใช้ไม่สำเร็จ");
    }
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
