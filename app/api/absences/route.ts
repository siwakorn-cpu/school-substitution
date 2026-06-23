import { requireUser } from "@/lib/auth";
import { canManageAbsence, canRecordOwnAbsence } from "@/lib/rbac";
import { parseDateInput } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";

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

  return redirectTo(request, "/absences");
}

function normalizeAbsenceType(value: FormDataEntryValue | null) {
  const type = String(value ?? "LEAVE");
  if (type === "OFFICIAL" || type === "PERSONAL" || type === "LEAVE") return type;
  return "LEAVE";
}
