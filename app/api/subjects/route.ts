import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";
import { logActivity } from "@/lib/auditLog";

export async function POST(request: Request) {
  const user = await requireAdmin();
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save_settings");

  if (intent === "create") {
    const name = String(formData.get("name") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim();
    const requiresSubstitution = formData.get("requiresSubstitution") === "on";
    if (!name) {
      return redirectTo(request, `/settings/subjects?subjectError=${encodeURIComponent("กรุณากรอกชื่อรายวิชา")}`);
    }
    try {
      const created = await prisma.subject.create({
        data: { name, code: code || null, requiresSubstitution }
      });
      await logActivity(user, "create", "Subject", created.id, `เพิ่มรายวิชา: ${name}`);
    } catch {
      return redirectTo(
        request,
        `/settings/subjects?subjectError=${encodeURIComponent(`มีรายวิชาชื่อ "${name}" อยู่แล้ว`)}`
      );
    }
    return redirectTo(request, `/settings/subjects?subjectMessage=${encodeURIComponent("เพิ่มรายวิชาเรียบร้อยแล้ว")}`);
  }

  if (intent === "update") {
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim();
    const requiresSubstitution = formData.get("requiresSubstitution") === "on";
    if (!name) {
      return redirectTo(request, `/settings/subjects?subjectError=${encodeURIComponent("กรุณากรอกชื่อรายวิชา")}`);
    }
    try {
      await prisma.subject.update({
        where: { id },
        data: { name, code: code || null, requiresSubstitution }
      });
      await logActivity(user, "update", "Subject", id, `แก้ไขรายวิชา: ${name}`);
    } catch {
      return redirectTo(
        request,
        `/settings/subjects?subjectError=${encodeURIComponent(`มีรายวิชาชื่อ "${name}" อยู่แล้ว`)}`
      );
    }
    return redirectTo(request, `/settings/subjects?subjectMessage=${encodeURIComponent("แก้ไขรายวิชาเรียบร้อยแล้ว")}`);
  }

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "");
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      return redirectTo(request, "/settings/subjects");
    }
    const scheduleCount = await prisma.teachingSchedule.count({ where: { subjectId: id } });
    if (scheduleCount > 0) {
      return redirectTo(
        request,
        `/settings/subjects?subjectError=${encodeURIComponent(
          `ลบรายวิชา "${subject.name}" ไม่ได้ เพราะยังมีตารางสอนที่ใช้รายวิชานี้อยู่`
        )}`
      );
    }
    await prisma.subject.delete({ where: { id } });
    await logActivity(user, "delete", "Subject", id, `ลบรายวิชา: ${subject.name}`);
    return redirectTo(request, `/settings/subjects?subjectMessage=${encodeURIComponent("ลบรายวิชาเรียบร้อยแล้ว")}`);
  }

  // intent === "save_settings": bulk toggle of requiresSubstitution
  const subjectIds = formData.getAll("subjectIds").map(String).filter(Boolean);
  const enabledIds = new Set(formData.getAll("requiresSubstitution").map(String));

  await prisma.$transaction(
    subjectIds.map((id) =>
      prisma.subject.update({
        where: { id },
        data: { requiresSubstitution: enabledIds.has(id) }
      })
    )
  );

  await logActivity(user, "update", "Subject", null, `แก้ไขการตั้งค่าวิชาที่ต้องจัดสอนแทน ${subjectIds.length} รายวิชา`);

  return redirectTo(request, "/settings/subjects");
}
