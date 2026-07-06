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

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "");
    const teacher = await prisma.teacher.findUnique({ where: { id } });
    if (!teacher) {
      return redirectTo(request, "/data-upload/teachers");
    }

    // Block when the teacher still has linked records — deleting would fail on FK
    // or orphan history. Tell the admin to use ปิดใช้งาน instead.
    const [scheduleCount, absenceCount, swapCount] = await Promise.all([
      prisma.teachingSchedule.count({ where: { teacherId: id } }),
      prisma.teacherAbsence.count({ where: { teacherId: id } }),
      prisma.swapRequest.count({
        where: { OR: [{ requesterTeacherId: id }, { targetTeacherId: id }] }
      })
    ]);

    if (scheduleCount > 0 || absenceCount > 0 || swapCount > 0) {
      const message = encodeURIComponent(
        `ลบครู ${teacher.name} ไม่ได้ เพราะยังมีตารางสอน/การลา/แลกคาบที่อ้างอิงอยู่ กรุณาเปลี่ยนสถานะเป็นปิดใช้งานแทน`
      );
      return redirectTo(request, `/data-upload/teachers?teacherError=${message}`);
    }

    // Detach a linked user account (teacherId is a nullable FK) before deleting.
    await prisma.user.updateMany({ where: { teacherId: id }, data: { teacherId: null } });
    await prisma.teacher.delete({ where: { id } });
    await logActivity(user, "delete", "Teacher", id, `ลบครู: ${teacher.name}`);
  }

  return redirectTo(request, "/data-upload/teachers");
}
