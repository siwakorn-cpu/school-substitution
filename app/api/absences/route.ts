import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageAbsence, canRecordOwnAbsence } from "@/lib/rbac";
import { parseDateInput } from "@/lib/date";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await requireUser();
  const canManageAllAbsences = canManageAbsence(user);
  const canRecordOwn = canRecordOwnAbsence(user);
  if (!canManageAllAbsences && !canRecordOwn) {
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
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
    return NextResponse.redirect(new URL("/absences", request.url), 303);
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

  return NextResponse.redirect(new URL("/absences", request.url), 303);
}

function normalizeAbsenceType(value: FormDataEntryValue | null) {
  const type = String(value ?? "LEAVE");
  if (type === "OFFICIAL" || type === "PERSONAL" || type === "LEAVE") return type;
  return "LEAVE";
}
