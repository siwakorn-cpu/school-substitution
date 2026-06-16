import { requireUser } from "@/lib/auth";
import { canManageSwap } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getSwapCandidates } from "@/lib/swapCandidates";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!canManageSwap(user)) {
    return redirectTo(request, "/dashboard");
  }
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "create") {
    const absencePeriodId = String(formData.get("absencePeriodId") ?? "");
    const toScheduleId = String(formData.get("toScheduleId") ?? "");
    const absencePeriod = await prisma.absencePeriod.findUnique({
      where: { id: absencePeriodId },
      include: { absence: true, schedule: true }
    });
    const candidates = await getSwapCandidates(absencePeriodId);
    const target = candidates.find((item) => item.id === toScheduleId);
    const canCreateForThisPeriod =
      user.role === "ADMIN" ||
      user.role === "HEAD" ||
      user.role === "DEPT_REP" ||
      (Boolean(user.teacherId) && absencePeriod?.absence.teacherId === user.teacherId);

    if (
      absencePeriod &&
      target &&
      canCreateForThisPeriod &&
      (absencePeriod.absence.type === "OFFICIAL" || absencePeriod.absence.type === "PERSONAL")
    ) {
      await prisma.swapRequest.create({
        data: {
          requesterTeacherId: absencePeriod.absence.teacherId,
          targetTeacherId: target.teacherId,
          date: absencePeriod.absence.date,
          fromScheduleId: absencePeriod.scheduleId,
          toScheduleId: target.id,
          requestedById: user.id
        }
      });
      await prisma.absencePeriod.update({
        where: { id: absencePeriodId },
        data: { actionType: "SWAP" }
      });
    }
  }

  if (intent === "approve" || intent === "reject") {
    const id = String(formData.get("id") ?? "");
    const swapForPermission = await prisma.swapRequest.findUnique({ where: { id } });
    if (!swapForPermission || swapForPermission.targetTeacherId !== user.teacherId) {
      return redirectTo(request, "/swaps");
    }

    if (intent === "reject") {
      await prisma.swapRequest.update({
        where: { id },
        data: { status: "REJECTED", approvedById: user.id }
      });
    } else {
      const swap = await prisma.swapRequest.findUnique({ where: { id } });
      if (swap) {
        const [fromSchedule, toSchedule] = await Promise.all([
          prisma.teachingSchedule.findUnique({ where: { id: swap.fromScheduleId } }),
          prisma.teachingSchedule.findUnique({ where: { id: swap.toScheduleId } })
        ]);

        if (fromSchedule && toSchedule) {
          await prisma.$transaction([
            prisma.swapRequest.update({
              where: { id },
              data: { status: "APPROVED", approvedById: user.id }
            }),
            prisma.temporarySchedule.create({
              data: {
                date: swap.date,
                originalScheduleId: fromSchedule.id,
                teacherId: toSchedule.teacherId,
                period: fromSchedule.period,
                classRoomId: fromSchedule.classRoomId,
                subjectId: fromSchedule.subjectId,
                specialRoomId: fromSchedule.specialRoomId,
                sourceType: "SWAP",
                sourceId: swap.id
              }
            }),
            prisma.temporarySchedule.create({
              data: {
                date: swap.date,
                originalScheduleId: toSchedule.id,
                teacherId: fromSchedule.teacherId,
                period: toSchedule.period,
                classRoomId: toSchedule.classRoomId,
                subjectId: toSchedule.subjectId,
                specialRoomId: toSchedule.specialRoomId,
                sourceType: "SWAP",
                sourceId: swap.id
              }
            })
          ]);
        }
      }
    }
  }

  return redirectTo(request, "/swaps");
}
