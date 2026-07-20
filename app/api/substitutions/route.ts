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

    return redirectTo(
      request,
      `/substitutions?absencePeriodId=${absencePeriodId}&savedMessage=${encodeURIComponent(
        `บันทึกว่า${FIELD_TRIP_NOTE}เรียบร้อยแล้ว`
      )}`
    );
  }

  if (intent === "external_substitute") {
    const externalSubstituteName = String(formData.get("externalSubstituteName") ?? "").trim();
    if (!externalSubstituteName) {
      return redirectTo(request, `/substitutions?absencePeriodId=${absencePeriodId}`);
    }

    // การเลือกนิสิต/นักศึกษาเข้าแทนจะปิดคำขอสลับคาบเดิมของคาบนี้
    const activeSwaps = await prisma.swapRequest.findMany({
      where: { absencePeriodId, status: { in: ["PENDING", "APPROVED"] } }
    });

    await prisma.$transaction([
      ...(activeSwaps.length > 0
        ? [
            prisma.temporarySchedule.deleteMany({
              where: { sourceType: "SWAP", sourceId: { in: activeSwaps.map((swap) => swap.id) } }
            }),
            prisma.swapRequest.updateMany({
              where: { id: { in: activeSwaps.map((swap) => swap.id) } },
              data: { status: "REJECTED", approvedById: user.id }
            })
          ]
        : []),
      prisma.temporarySchedule.deleteMany({
        where: { sourceType: "SUBSTITUTE", sourceId: absencePeriodId }
      }),
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
          subjectId: absencePeriod.schedule.subjectId,
          specialRoomId: absencePeriod.schedule.specialRoomId,
          assignedById: user.id,
          status: "APPROVED",
          approvedById: user.id,
          note: "นิสิตนักศึกษาฝึกประสบการณ์วิชาชีพเข้าแทน"
        },
        update: {
          substituteTeacherId: null,
          externalSubstituteName,
          assignedById: user.id,
          status: "APPROVED",
          approvedById: user.id,
          subjectId: absencePeriod.schedule.subjectId,
          note: "นิสิตนักศึกษาฝึกประสบการณ์วิชาชีพเข้าแทน"
        }
      }),
      prisma.absencePeriod.update({
        where: { id: absencePeriodId },
        data: { actionType: "SUBSTITUTE", status: "DONE", note: null }
      })
    ]);

    await logActivity(
      user,
      "external_substitute",
      "Substitution",
      absencePeriodId,
      `นิสิตนักศึกษาฝึกประสบการณ์วิชาชีพเข้าแทน: ${externalSubstituteName} (${formatThaiDate(
        absencePeriod.absence.date
      )} คาบ ${absencePeriod.period})`
    );

    return redirectTo(
      request,
      `/substitutions?absencePeriodId=${absencePeriodId}&savedMessage=${encodeURIComponent(
        `บันทึกนิสิต/นักศึกษาเข้าแทนเรียบร้อยแล้ว: ${externalSubstituteName}`
      )}`
    );
  }

  const valid = await validateSubstitute(absencePeriodId, substituteTeacherId, {
    departmentId: null
  });
  if (!valid) {
    return redirectTo(request, `/substitutions?absencePeriodId=${absencePeriodId}`);
  }

  // จัดสอนแทน = ยกเลิกคำขอสลับคาบเดิมของคาบนี้ (ถ้ามี) ไม่ให้สองวิธีค้างซ้อนกัน
  const activeSwaps = await prisma.swapRequest.findMany({
    where: { absencePeriodId, status: { in: ["PENDING", "APPROVED"] } }
  });
  if (activeSwaps.length > 0) {
    await prisma.$transaction([
      prisma.temporarySchedule.deleteMany({
        where: { sourceType: "SWAP", sourceId: { in: activeSwaps.map((swap) => swap.id) } }
      }),
      prisma.swapRequest.updateMany({
        where: { id: { in: activeSwaps.map((swap) => swap.id) } },
        data: { status: "REJECTED", approvedById: user.id }
      })
    ]);
  }

  await prisma.substitution.upsert({
    where: { absencePeriodId },
    create: {
      absencePeriodId,
      originalTeacherId: absencePeriod.absence.teacherId,
      substituteTeacherId,
      externalSubstituteName: null,
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
      externalSubstituteName: null,
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

  return redirectTo(
    request,
    `/substitutions?absencePeriodId=${absencePeriodId}&savedMessage=${encodeURIComponent(
      `จัดครูสอนแทนเรียบร้อยแล้ว: ${substituteTeacher?.name ?? "ครูที่เลือก"} (คาบ ${absencePeriod.period})`
    )}`
  );
}
