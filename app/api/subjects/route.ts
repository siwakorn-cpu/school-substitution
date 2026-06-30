import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";
import { logActivity } from "@/lib/auditLog";

export async function POST(request: Request) {
  const user = await requireAdmin();
  const formData = await request.formData();
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
