import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageSubstitution } from "@/lib/rbac";
import { validateSubstitute } from "@/lib/recommendSubstitutes";
import { redirectTo } from "@/lib/redirect";
import { parseDateInput, toDateInputValue, formatThaiDate } from "@/lib/date";
import { getDepartmentScopeId, roleUsesDepartmentScope } from "@/lib/departmentScope";
import { logActivity } from "@/lib/auditLog";
import { FIELD_TRIP_NOTE } from "@/lib/substitutionNotes";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!(await canManageSubstitution(user))) {
    return redirectTo(request, "/dashboard");
  }
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "assign");
  const absencePeriodId = String(formData.get("absencePeriodId") ?? "");
  const substituteTeacherId = String(formData.get("substituteTeacherId") ?? "");
  const usesDepartmentScope = roleUsesDepartmentScope(user);
  const departmentScopeId = await getDepartmentScopeId(user);

  const absencePeriod = await prisma.absencePeriod.findUnique({
    where: { id: absencePeriodId },
    include: {
      absence: { include: { teacher: true } },
      schedule: true
    }
  });

  if (!absencePeriod) {
    return redirectTo(request, "/substitutions");
  }

  if (absencePeriod.absence.type !== "LEAVE") {
    return redirectTo(request, "/substitutions");
  }

  if (usesDepartmentScope && absencePeriod.absence.teacher.departmentId !== departmentScopeId) {
    return redirectTo(request, "/substitutions");
  }

  const today = parseDateInput(toDateInputValue());
  if (absencePeriod.absence.date < today && user.role !== "ADMIN") {
    return redirectTo(request, `/substitutions?absencePeriodId=${absencePeriodId}`);
  }

  if (intent === "field_trip") {
    await prisma.$transaction([
      prisma.temporarySchedule.deleteMany({ where: { sourceType: "SUBSTITUTE", sourceId: absencePeriodId } }),
      prisma.substitution.deleteMany({ where: { absencePeriodId } }),
      prisma.absencePeriod.update({
        where: { id: absencePeriodId },
        data: { actionType: "NONE", status: "DONE", note: FIELD_TRIP_NOTE }
      })
    ]);

    await logActivity(
      user,
      "mark_field_trip",
      "AbsencePeriod",
      absencePeriodId,
      `${FIELD_TRIP_NOTE}: ${absencePeriod.absence.teacher.name} (${formatThaiDate(absencePeriod.absence.date)} คาบ ${absencePeriod.period})`
    );

    return redirectTo(request, `/substitutions?absencePeriodId=${absencePeriodId}`);
  }

  const valid = await validateSubstitute(absencePeriodId, substituteTeacherId, {
    departmentId: null
  });
  if (!valid) {
    return redirectTo(request, `/substitutions?absencePeriodId=${absencePeriodId}`);
  }

  await prisma.substitution.upsert({
    where: { absencePeriodId },
    create: {
      absencePeriodId,
      originalTeacherId: absencePeriod.absence.teacherId,
      substituteTeacherId,
      date: absencePeriod.absence.date,
      period: absencePeriod.period,
      classRoomId: absencePeriod.schedule.classRoomId,
      subjectId: absencePeriod.schedule.subjectId,
      specialRoomId: absencePeriod.schedule.specialRoomId,
      assignedById: user.id,
      // Sick-leave substitutions are assigned directly by staff — no approval step from the substitute.
      status: "APPROVED"
    },
    update: {
      substituteTeacherId,
      assignedById: user.id,
      status: "APPROVED",
      note: null
    }
  });

  await prisma.absencePeriod.update({
    where: { id: absencePeriodId },
    data: { actionType: "SUBSTITUTE", status: "DONE", note: null }
  });

  const substituteTeacher = await prisma.teacher.findUnique({ where: { id: substituteTeacherId } });
  await logActivity(
    user,
    "assign_substitute",
    "Substitution",
    absencePeriodId,
    `จัดครูสอนแทน: ${absencePeriod.absence.teacher.name} -> ${substituteTeacher?.name ?? substituteTeacherId} (${formatThaiDate(absencePeriod.absence.date)} คาบ ${absencePeriod.period})`
  );

  return redirectTo(request, `/substitutions?absencePeriodId=${absencePeriodId}`);
}
