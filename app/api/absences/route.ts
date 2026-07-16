import { requireUser } from "@/lib/auth";
import { canManageAbsence, canRecordOwnAbsence } from "@/lib/rbac";
import { parseDateInput, formatThaiDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";
import { logActivity } from "@/lib/auditLog";

export async function POST(request: Request) {
  const user = await requireUser();
  const [canManageAllAbsences, canRecordOwn] = await Promise.all([
    canManageAbsence(user),
    canRecordOwnAbsence(user)
  ]);
  if (!canManageAllAbsences && !canRecordOwn) {
    return redirectTo(request, "/dashboard");
  }
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "single");
  const date = parseDateInput(String(formData.get("date") ?? ""));
  const requestedType = normalizeAbsenceType(formData.get("type"));
  const note = String(formData.get("note") ?? "").trim();

  if (intent === "delete" || intent === "update") {
    const absenceId = String(formData.get("absenceId") ?? "");
    const absence = await prisma.teacherAbsence.findUnique({
      where: { id: absenceId },
      include: { periods: { select: { id: true } } }
    });
    if (!absence) return redirectTo(request, "/absences");
    if (!canManageAllAbsences && absence.teacherId !== user.teacherId) {
      return redirectTo(request, "/absences");
    }
    const periodIds = absence.periods.map((period) => period.id);

    if (intent === "delete") {
      await purgePeriodProcessing(periodIds);
      await prisma.$transaction([
        prisma.absencePeriod.deleteMany({ where: { absenceId } }),
        prisma.teacherAbsence.delete({ where: { id: absenceId } })
      ]);
      await logActivity(
        user,
        "delete",
        "TeacherAbsence",
        absenceId,
        `ลบรายการลา/ไปราชการ วันที่ ${formatThaiDate(absence.date)}`
      );
      return redirectTo(request, "/absences");
    }

    // intent === "update": edit type + note. Teachers cannot set sick leave.
    const newType = !canManageAllAbsences && requestedType === "LEAVE" ? "OFFICIAL" : requestedType;
    if (absence.type !== newType) {
      // changing type re-routes the record, so clear any prior substitution/swap processing
      await purgePeriodProcessing(periodIds);
      await prisma.absencePeriod.updateMany({
        where: { absenceId },
        data: { actionType: "NONE", status: "PENDING" }
      });
    }
    await prisma.teacherAbsence.update({
      where: { id: absenceId },
      data: { type: newType, note }
    });
    await logActivity(
      user,
      "update",
      "TeacherAbsence",
      absenceId,
      `แก้ไขรายการลา/ไปราชการ วันที่ ${formatThaiDate(absence.date)}`
    );
    return redirectTo(request, "/absences");
  }

  if (intent === "bulk") {
    if (!canManageAllAbsences) return redirectTo(request, "/absences");
    const teacherIds = formData.getAll("teacherIds").map(String).filter(Boolean);
    const type = requestedType === "OFFICIAL" ? "PERSONAL" : requestedType;
    if (teacherIds.length === 0) return redirectTo(request, "/absences");

    await prisma.$transaction(async (tx) => {
      for (const teacherId of teacherIds) {
        const teacher = await tx.teacher.findUnique({ where: { id: teacherId } });
        if (!teacher) continue;

        const absence = await tx.teacherAbsence.create({
          data: {
            teacherId,
            date,
            type,
            note,
            createdById: user.id
          }
        });

        const schedules = await tx.teachingSchedule.findMany({
          where: {
            teacherId,
            dayOfWeek: date.getDay(),
            subject: { requiresSubstitution: true }
          },
          select: { id: true, period: true }
        });

        if (schedules.length > 0) {
          await tx.absencePeriod.createMany({
            data: schedules.map((schedule) => ({
              absenceId: absence.id,
              scheduleId: schedule.id,
              period: schedule.period
            }))
          });
        }
      }
    });

    await logActivity(
      user,
      "create",
      "TeacherAbsence",
      null,
      `บันทึกลา/ไปราชการแบบกลุ่ม ${teacherIds.length} คน วันที่ ${formatThaiDate(date)}`
    );
    return redirectTo(request, "/absences");
  }

  const requestedTeacherId = String(formData.get("teacherId") ?? "");
  const teacherId = canManageAllAbsences ? requestedTeacherId : user.teacherId ?? "";
  const type = !canManageAllAbsences && requestedType === "LEAVE" ? "OFFICIAL" : requestedType;
  const scheduleIds = formData.getAll("scheduleIds").map(String).filter(Boolean);

  if (!teacherId || scheduleIds.length === 0 || (!canManageAllAbsences && requestedTeacherId !== user.teacherId)) {
    return redirectTo(request, "/absences");
  }

  const absence = await prisma.teacherAbsence.create({
    data: {
      teacherId,
      date,
      type,
      note,
      createdById: user.id
    }
  });

  for (const scheduleId of scheduleIds) {
    const schedule = await prisma.teachingSchedule.findUnique({
      where: { id: scheduleId },
      include: { subject: true }
    });
    if (!canManageAllAbsences && schedule?.teacherId !== user.teacherId) continue;
    if (!schedule || !schedule.subject.requiresSubstitution) continue;
    await prisma.absencePeriod.create({
      data: {
        absenceId: absence.id,
        scheduleId,
        period: schedule.period
      }
    });
  }

  await logActivity(user, "create", "TeacherAbsence", absence.id, `บันทึกลา/ไปราชการ วันที่ ${formatThaiDate(date)}`);
  return redirectTo(request, "/absences");
}

function normalizeAbsenceType(value: FormDataEntryValue | null) {
  const type = String(value ?? "LEAVE");
  // SICK_ADVANCE = ลาป่วย(ล่วงหน้า) ทำงานเหมือนลากิจ — ครูบันทึกเองและจัดการผ่านหน้าแลกคาบได้
  if (type === "OFFICIAL" || type === "PERSONAL" || type === "LEAVE" || type === "SICK_ADVANCE") return type;
  return "LEAVE";
}

// Remove substitutions, swap requests, and temporary schedules tied to the given
// absence periods so the records can be safely deleted or re-processed.
async function purgePeriodProcessing(periodIds: string[]) {
  if (periodIds.length === 0) return;
  const swaps = await prisma.swapRequest.findMany({
    where: { absencePeriodId: { in: periodIds } },
    select: { id: true }
  });
  await prisma.$transaction([
    prisma.temporarySchedule.deleteMany({ where: { sourceType: "SUBSTITUTE", sourceId: { in: periodIds } } }),
    prisma.temporarySchedule.deleteMany({
      where: { sourceType: "SWAP", sourceId: { in: swaps.map((swap) => swap.id) } }
    }),
    prisma.substitution.deleteMany({ where: { absencePeriodId: { in: periodIds } } }),
    prisma.swapRequest.deleteMany({ where: { absencePeriodId: { in: periodIds } } })
  ]);
}
