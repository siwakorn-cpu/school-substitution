import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await requireAdmin();
  const exportedAt = new Date();

  const [
    schoolTerms,
    departments,
    teachers,
    users,
    rooms,
    subjects,
    teachingSchedules,
    teacherAbsences,
    absencePeriods,
    substitutions,
    swapRequests,
    temporarySchedules,
    rolePermissions,
    activityPeriods
  ] = await Promise.all([
    prisma.schoolTerm.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.teacher.findMany({ orderBy: { code: "asc" } }),
    prisma.user.findMany({ orderBy: { username: "asc" } }),
    prisma.room.findMany({ orderBy: { name: "asc" } }),
    prisma.subject.findMany({ orderBy: [{ code: "asc" }, { name: "asc" }] }),
    prisma.teachingSchedule.findMany({ orderBy: [{ term: "asc" }, { teacherId: "asc" }, { dayOfWeek: "asc" }, { period: "asc" }] }),
    prisma.teacherAbsence.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.absencePeriod.findMany(),
    prisma.substitution.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.swapRequest.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.temporarySchedule.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.rolePermission.findMany({ orderBy: [{ role: "asc" }, { permission: "asc" }] }),
    prisma.activityPeriod.findMany({ orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }] })
  ]);

  const backup = {
    metadata: {
      app: "school-substitution",
      exportedAt: exportedAt.toISOString(),
      exportedBy: user.username,
      formatVersion: 1
    },
    data: {
      schoolTerms,
      departments,
      teachers,
      users,
      rooms,
      subjects,
      teachingSchedules,
      teacherAbsences,
      absencePeriods,
      substitutions,
      swapRequests,
      temporarySchedules,
      rolePermissions,
      activityPeriods
    }
  };
  const datePart = exportedAt.toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");

  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="school-substitution-backup-${datePart}.json"`,
      "Cache-Control": "no-store"
    }
  });
}
