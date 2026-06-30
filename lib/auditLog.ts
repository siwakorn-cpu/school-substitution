import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

export async function logActivity(
  user: SessionUser,
  action: string,
  targetType: string,
  targetId: string | null,
  summary: string
) {
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      username: user.username,
      role: user.role,
      action,
      targetType,
      targetId,
      summary
    }
  });
}
