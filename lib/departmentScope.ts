import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export function roleUsesDepartmentScope(user: SessionUser) {
  return user.role === "HEAD" || user.role === "DEPT_REP";
}

export async function getDepartmentScopeId(user: SessionUser) {
  if (!roleUsesDepartmentScope(user)) return null;
  if (!user.teacherId) return "__none__";

  const teacher = await prisma.teacher.findUnique({
    where: { id: user.teacherId },
    select: { departmentId: true }
  });

  return teacher?.departmentId ?? "__none__";
}
