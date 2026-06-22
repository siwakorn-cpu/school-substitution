import { requireUser } from "@/lib/auth";
import { canApproveSwap, canManageSwap } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { validateSubstitute } from "@/lib/recommendSubstitutes";
import { validateSwapCandidate } from "@/lib/swapCandidates";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!(await canManageSwap(user))) {
    return redirectTo(request, "/dashboard");
  }
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "substitute") {
    const absencePeriodId = String(formData.get("absencePeriodId") ?? "");
    const substituteTeacherId = String(formData.get("substituteTeacherId") ?? "");
    const requestedSubjectId = String(formData.get("subjectId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();

    if (!(await canApproveScheduleChange(user))) {
      return redirectTo(request, `/swaps?absencePeriodId=${absencePeriodId}`);
    }

    const valid = await validateSubstitute(absencePeriodId, substituteTeacherId);
    const absencePeriod = await prisma.absencePeriod.findUnique({
      where: { id: absencePeriodId },
      include: { absence: true, schedule: true }
    });

    if (valid && absencePeriod) {
      const subject = requestedSubjectId
        ? await prisma.subject.findUnique({ where: { id: requestedSubjectId } })
        : null;
      const subjectId = subject?.id ?? absencePeriod.schedule.subjectId;
      await prisma.$transaction([
        prisma.substitution.upsert({
          where: { absencePeriodId },
          create: {
            absencePeriodId,
            originalTeacherId: absencePeriod.absence.teacherId,
            substituteTeacherId,
            date: absencePeriod.absence.date,
            period: absencePeriod.period,
            classRoomId: absencePeriod.schedule.classRoomId,
            subjectId,
            specialRoomId: absencePeriod.schedule.specialRoomId,
            assignedById: user.id,
            note: reason || "เข้าแทน"
          },
          update: {
            substituteTeacherId,
            assignedById: user.id,
            note: reason || "เข้าแทน"
          }
        }),
        prisma.absencePeriod.update({
          where: { id: absencePeriodId },
          data: { actionType: "SUBSTITUTE", status: "DONE" }
        }),
        prisma.temporarySchedule.create({
          data: {
            date: absencePeriod.absence.date,
            originalScheduleId: absencePeriod.scheduleId,
            teacherId: substituteTeacherId,
            period: absencePeriod.period,
            classRoomId: absencePeriod.schedule.classRoomId,
            subjectId,
            specialRoomId: absencePeriod.schedule.specialRoomId,
            sourceType: "SUBSTITUTE",
            sourceId: absencePeriodId
          }
        })
      ]);
    }

    return redirectTo(request, `/swaps?absencePeriodId=${absencePeriodId}`);
  }

  if (intent === "create") {
    const absencePeriodId = String(formData.get("absencePeriodId") ?? "");
    const toScheduleId = String(formData.get("toScheduleId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    const absencePeriod = await prisma.absencePeriod.findUnique({
      where: { id: absencePeriodId },
      include: { absence: true, schedule: true }
    });
    const target = await validateSwapCandidate(absencePeriodId, toScheduleId);
    const canCreateForThisPeriod =
      (await canApproveScheduleChange(user)) ||
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
          requestedById: user.id,
          splitDoublePeriod: target.splitDoublePeriod,
          note: reason
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
    if (!swapForPermission || (!(await canApproveScheduleChange(user)) && swapForPermission.targetTeacherId !== user.teacherId)) {
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
          const targetDate = dateForDayOfWeek(swap.date, toSchedule.dayOfWeek);
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
                subjectId: toSchedule.subjectId,
                specialRoomId: toSchedule.specialRoomId,
                sourceType: "SWAP",
                sourceId: swap.id
              }
            }),
            prisma.temporarySchedule.create({
              data: {
                date: targetDate,
                originalScheduleId: toSchedule.id,
                teacherId: fromSchedule.teacherId,
                period: toSchedule.period,
                classRoomId: toSchedule.classRoomId,
                subjectId: fromSchedule.subjectId,
                specialRoomId: fromSchedule.specialRoomId,
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

function canApproveScheduleChange(user: Awaited<ReturnType<typeof requireUser>>) {
  return canApproveSwap(user);
}

function dateForDayOfWeek(sourceDate: Date, targetDayOfWeek: number) {
  const date = new Date(sourceDate);
  date.setDate(date.getDate() + targetDayOfWeek - date.getDay());
  return date;
}
