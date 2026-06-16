import { requireUser } from "@/lib/auth";
import { canManageAbsence, canRecordOwnAbsence } from "@/lib/rbac";
import { parseDateInput } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: Request) {
  const user = await requireUser();
  const canManageAllAbsences = canManageAbsence(user);
  const canRecordOwn = canRecordOwnAbsence(user);
  if (!canManageAllAbsences && !canRecordOwn) {
    return redirectTo(request, "/dashboard");
  }
  const formData = await request.formData();
  const requestedTeacherId = String(formData.get("teacherId") ?? "");
  const teacherId = canManageAllAbsences ? requestedTeacherId : user.teacherId ?? "";
  const date = parseDateInput(String(formData.get("date") ?? ""));
  const requestedType = normalizeAbsenceType(formData.get("type"));
  const type = !canManageAllAbsences && requestedType === "LEAVE" ? "OFFICIAL" : requestedType;
  const note = String(formData.get("note") ?? "").trim();
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
    const schedule = await prisma.teachingSchedule.findUnique({ where: { id: scheduleId } });
    if (!canManageAllAbsences && schedule?.teacherId !== user.teacherId) continue;
    if (!schedule) continue;
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
