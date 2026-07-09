import { requireUser } from "@/lib/auth";
import { canApproveSwap, canManageSwap } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { validateSubstitute } from "@/lib/recommendSubstitutes";
import { validateSwapCandidate } from "@/lib/swapCandidates";
import { redirectTo } from "@/lib/redirect";
import { parseDateInput, toDateInputValue, formatThaiDate } from "@/lib/date";
import { logActivity } from "@/lib/auditLog";

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

    // Back-dated changes are admin-only (matches the จัดสอนแทน page).
    const today = parseDateInput(toDateInputValue());
    if (absencePeriod && absencePeriod.absence.date < today && user.role !== "ADMIN") {
      return redirectTo(request, `/swaps?absencePeriodId=${absencePeriodId}`);
    }

    if (valid && absencePeriod) {
      const subject = requestedSubjectId
        ? await prisma.subject.findUnique({ where: { id: requestedSubjectId } })
        : null;
      const subjectId = subject?.id ?? absencePeriod.schedule.subjectId;
      // Awaiting the substitute teacher's own approval — no temporary schedule yet.
      await prisma.$transaction([
        prisma.substitution.upsert({
          where: { absencePeriodId },
          create: {
            absencePeriodId,
            originalTeacherId: absencePeriod.absence.teacherId,
            substituteTeacherId,
            externalSubstituteName: null,
            date: absencePeriod.absence.date,
            period: absencePeriod.period,
            classRoomId: absencePeriod.schedule.classRoomId,
            subjectId,
            specialRoomId: absencePeriod.schedule.specialRoomId,
            assignedById: user.id,
            status: "PENDING",
            approvedById: null,
            note: reason || "เข้าแทน"
          },
          update: {
            substituteTeacherId,
            externalSubstituteName: null,
            assignedById: user.id,
            status: "PENDING",
            approvedById: null,
            note: reason || "เข้าแทน"
          }
        }),
        prisma.absencePeriod.update({
          where: { id: absencePeriodId },
          data: { actionType: "SUBSTITUTE", status: "PENDING" }
        })
      ]);
      const substituteTeacher = await prisma.teacher.findUnique({ where: { id: substituteTeacherId } });
      await logActivity(
        user,
        "request_substitute",
        "Substitution",
        absencePeriodId,
        `ขอให้เข้าสอนแทน: ${substituteTeacher?.name ?? substituteTeacherId} (${formatThaiDate(absencePeriod.absence.date)} คาบ ${absencePeriod.period})`
      );
    }

    return redirectTo(request, `/swaps?absencePeriodId=${absencePeriodId}`);
  }

  if (intent === "external_substitute") {
    const absencePeriodId = String(formData.get("absencePeriodId") ?? "");
    const requestedSubjectId = String(formData.get("subjectId") ?? "");
    const externalSubstituteName = String(formData.get("externalSubstituteName") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();

    if (!externalSubstituteName) {
      return redirectTo(request, `/swaps?absencePeriodId=${absencePeriodId}`);
    }

    const absencePeriod = await prisma.absencePeriod.findUnique({
      where: { id: absencePeriodId },
      include: { absence: true, schedule: true }
    });

    const canRecordExternalSubstitute =
      (await canApproveScheduleChange(user)) ||
      (Boolean(user.teacherId) && absencePeriod?.absence.teacherId === user.teacherId);

    const today = parseDateInput(toDateInputValue());
    if (
      !absencePeriod ||
      !canRecordExternalSubstitute ||
      (absencePeriod.absence.date < today && user.role !== "ADMIN")
    ) {
      return redirectTo(request, `/swaps?absencePeriodId=${absencePeriodId}`);
    }

    const subject = requestedSubjectId ? await prisma.subject.findUnique({ where: { id: requestedSubjectId } }) : null;
    const subjectId = subject?.id ?? absencePeriod.schedule.subjectId;
    const note = reason || "นิสิตนักศึกษาฝึกประสบการณ์วิชาชีพเข้าแทน";

    await prisma.$transaction([
      prisma.substitution.upsert({
        where: { absencePeriodId },
        create: {
          absencePeriodId,
          originalTeacherId: absencePeriod.absence.teacherId,
          substituteTeacherId: null,
          externalSubstituteName,
          date: absencePeriod.absence.date,
          period: absencePeriod.period,
          classRoomId: absencePeriod.schedule.classRoomId,
          subjectId,
          specialRoomId: absencePeriod.schedule.specialRoomId,
          assignedById: user.id,
          status: "APPROVED",
          approvedById: user.id,
          note
        },
        update: {
          substituteTeacherId: null,
          externalSubstituteName,
          assignedById: user.id,
          status: "APPROVED",
          approvedById: user.id,
          subjectId,
          note
        }
      }),
      prisma.absencePeriod.update({
        where: { id: absencePeriodId },
        data: { actionType: "SUBSTITUTE", status: "DONE" }
      })
    ]);

    await logActivity(
      user,
      "external_substitute",
      "Substitution",
      absencePeriodId,
      `นิสิตนักศึกษาฝึกประสบการณ์วิชาชีพเข้าแทน: ${externalSubstituteName} (${formatThaiDate(absencePeriod.absence.date)} คาบ ${absencePeriod.period})`
    );

    return redirectTo(request, `/swaps?absencePeriodId=${absencePeriodId}`);
  }

  if (intent === "approve_substitute" || intent === "reject_substitute") {
    const absencePeriodId = String(formData.get("absencePeriodId") ?? "");
    const [substitution, absencePeriod] = await Promise.all([
      prisma.substitution.findUnique({ where: { absencePeriodId } }),
      prisma.absencePeriod.findUnique({ where: { id: absencePeriodId } })
    ]);
    const canRespondAsSubstitute =
      substitution &&
      substitution.status === "PENDING" &&
      Boolean(substitution.substituteTeacherId) &&
      Boolean(user.teacherId) &&
      substitution.substituteTeacherId === user.teacherId;

    if (canRespondAsSubstitute && absencePeriod) {
      const substituteTeacherId = substitution.substituteTeacherId;
      if (!substituteTeacherId) {
        return redirectTo(request, `/swaps?absencePeriodId=${absencePeriodId}`);
      }

      if (intent === "reject_substitute") {
        await prisma.$transaction([
          prisma.substitution.update({
            where: { absencePeriodId },
            data: { status: "REJECTED", approvedById: user.id }
          }),
          prisma.absencePeriod.update({
            where: { id: absencePeriodId },
            data: { actionType: "NONE", status: "PENDING" }
          })
        ]);
        await logActivity(user, "reject_substitute", "Substitution", absencePeriodId, "ปฏิเสธคำขอเข้าสอนแทน");
      } else {
        await prisma.$transaction([
          prisma.substitution.update({
            where: { absencePeriodId },
            data: { status: "APPROVED", approvedById: user.id }
          }),
          prisma.absencePeriod.update({
            where: { id: absencePeriodId },
            data: { status: "DONE" }
          }),
          prisma.temporarySchedule.create({
            data: {
              date: substitution.date,
              originalScheduleId: absencePeriod.scheduleId,
              teacherId: substituteTeacherId,
              period: substitution.period,
              classRoomId: substitution.classRoomId,
              subjectId: substitution.subjectId,
              specialRoomId: substitution.specialRoomId,
              sourceType: "SUBSTITUTE",
              sourceId: absencePeriodId
            }
          })
        ]);
        await logActivity(user, "approve_substitute", "Substitution", absencePeriodId, "อนุมัติคำขอเข้าสอนแทน");
      }
    }

    return redirectTo(request, `/swaps?absencePeriodId=${absencePeriodId}`);
  }

  if (intent === "create") {
    const absencePeriodId = String(formData.get("absencePeriodId") ?? "");
    const toScheduleId = String(formData.get("toScheduleId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    const toDateInput = String(formData.get("toDate") ?? "").trim();
    const absencePeriod = await prisma.absencePeriod.findUnique({
      where: { id: absencePeriodId },
      include: { absence: true, schedule: true }
    });
    const target = await validateSwapCandidate(absencePeriodId, toScheduleId);

    // Back-dated changes are admin-only (matches the จัดสอนแทน page).
    const today = parseDateInput(toDateInputValue());
    if (absencePeriod && absencePeriod.absence.date < today && user.role !== "ADMIN") {
      return redirectTo(request, `/swaps?absencePeriodId=${absencePeriodId}`);
    }

    const canCreateForThisPeriod =
      (await canApproveScheduleChange(user)) ||
      (Boolean(user.teacherId) && absencePeriod?.absence.teacherId === user.teacherId);
    const toDate = toDateInput ? parseDateInput(toDateInput) : null;
    const toDateMatchesTarget = !toDate || !target || toDate.getDay() === target.dayOfWeek;

    if (
      absencePeriod &&
      target &&
      canCreateForThisPeriod &&
      toDateMatchesTarget &&
      (absencePeriod.absence.type === "OFFICIAL" || absencePeriod.absence.type === "PERSONAL")
    ) {
      const existingPending = await prisma.swapRequest.findFirst({
        where: { absencePeriodId, status: "PENDING" }
      });

      if (existingPending) {
        await prisma.swapRequest.update({
          where: { id: existingPending.id },
          data: {
            targetTeacherId: target.teacherId,
            toScheduleId: target.id,
            toDate,
            splitDoublePeriod: target.splitDoublePeriod,
            note: reason,
            requestedById: user.id
          }
        });
      } else {
        await prisma.swapRequest.create({
          data: {
            absencePeriodId,
            requesterTeacherId: absencePeriod.absence.teacherId,
            targetTeacherId: target.teacherId,
            date: absencePeriod.absence.date,
            toDate,
            fromScheduleId: absencePeriod.scheduleId,
            toScheduleId: target.id,
            requestedById: user.id,
            splitDoublePeriod: target.splitDoublePeriod,
            note: reason
          }
        });
      }
      await prisma.absencePeriod.update({
        where: { id: absencePeriodId },
        data: { actionType: "SWAP" }
      });

      const targetTeacher = await prisma.teacher.findUnique({ where: { id: target.teacherId } });
      await logActivity(
        user,
        existingPending ? "update_swap_request" : "create_swap_request",
        "SwapRequest",
        absencePeriodId,
        `ส่งคำขอสลับคาบกับ ${targetTeacher?.name ?? target.teacherId} (${formatThaiDate(absencePeriod.absence.date)})`
      );
    }

    return redirectTo(request, `/swaps?absencePeriodId=${absencePeriodId}`);
  }

  if (intent === "cancel_swap") {
    const absencePeriodId = String(formData.get("absencePeriodId") ?? "");
    const id = String(formData.get("id") ?? "");
    const swap = await prisma.swapRequest.findUnique({ where: { id } });
    const canCancel =
      swap &&
      swap.status === "PENDING" &&
      ((await canApproveScheduleChange(user)) || (Boolean(user.teacherId) && swap.requesterTeacherId === user.teacherId));

    if (canCancel) {
      await prisma.swapRequest.delete({ where: { id } });
      if (absencePeriodId) {
        await prisma.absencePeriod.update({
          where: { id: absencePeriodId },
          data: { actionType: "NONE" }
        });
      }
      await logActivity(user, "cancel_swap_request", "SwapRequest", id, "ยกเลิกคำขอสลับคาบ");
    }

    return redirectTo(request, `/swaps?absencePeriodId=${absencePeriodId}`);
  }

  if (intent === "cancel_substitute") {
    const absencePeriodId = String(formData.get("absencePeriodId") ?? "");

    if (await canApproveScheduleChange(user)) {
      await prisma.$transaction([
        prisma.temporarySchedule.deleteMany({ where: { sourceType: "SUBSTITUTE", sourceId: absencePeriodId } }),
        prisma.substitution.deleteMany({ where: { absencePeriodId } }),
        prisma.absencePeriod.update({
          where: { id: absencePeriodId },
          data: { actionType: "NONE", status: "PENDING" }
        })
      ]);
      await logActivity(user, "cancel_substitute", "Substitution", absencePeriodId, "ยกเลิกการจัดเข้าสอนแทน");
    }

    return redirectTo(request, `/swaps?absencePeriodId=${absencePeriodId}`);
  }

  if (intent === "approve" || intent === "reject") {
    const id = String(formData.get("id") ?? "");
    const swapForPermission = await prisma.swapRequest.findUnique({ where: { id } });
    if (!swapForPermission || (!(await canApproveScheduleChange(user)) && swapForPermission.targetTeacherId !== user.teacherId)) {
      return redirectTo(request, "/swaps");
    }

    if (intent === "reject") {
      // Reverting a previously approved swap: also remove its temporary schedules.
      await prisma.$transaction([
        prisma.temporarySchedule.deleteMany({ where: { sourceType: "SWAP", sourceId: id } }),
        prisma.swapRequest.update({
          where: { id },
          data: { status: "REJECTED", approvedById: user.id }
        })
      ]);
      await logActivity(user, "reject_swap_request", "SwapRequest", id, "ไม่อนุมัติคำขอสลับคาบ");
    } else {
      const swap = await prisma.swapRequest.findUnique({ where: { id } });
      if (swap) {
        const [fromSchedule, toSchedule] = await Promise.all([
          prisma.teachingSchedule.findUnique({ where: { id: swap.fromScheduleId } }),
          prisma.teachingSchedule.findUnique({ where: { id: swap.toScheduleId } })
        ]);

        if (fromSchedule && toSchedule) {
          const targetDate = swap.toDate ?? dateForDayOfWeek(swap.date, toSchedule.dayOfWeek);
          await prisma.$transaction([
            // Clear any existing temp schedules first so re-approving never duplicates.
            prisma.temporarySchedule.deleteMany({ where: { sourceType: "SWAP", sourceId: swap.id } }),
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
          await logActivity(user, "approve_swap_request", "SwapRequest", id, "อนุมัติคำขอสลับคาบ");
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
