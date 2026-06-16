import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateSubstitute } from "@/lib/recommendSubstitutes";

export async function POST(request: Request) {
  const user = await requireAdmin();
  const formData = await request.formData();
  const absencePeriodId = String(formData.get("absencePeriodId") ?? "");
  const substituteTeacherId = String(formData.get("substituteTeacherId") ?? "");

  const valid = await validateSubstitute(absencePeriodId, substituteTeacherId);
  if (!valid) {
    return NextResponse.redirect(new URL(`/substitutions?absencePeriodId=${absencePeriodId}`, request.url), 303);
  }

  const absencePeriod = await prisma.absencePeriod.findUnique({
    where: { id: absencePeriodId },
    include: { absence: true, schedule: true }
  });

  if (!absencePeriod) {
    return NextResponse.redirect(new URL("/substitutions", request.url), 303);
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
      assignedById: user.id
    },
    update: {
      substituteTeacherId,
      assignedById: user.id,
      note: null
    }
  });

  await prisma.absencePeriod.update({
    where: { id: absencePeriodId },
    data: { actionType: "SUBSTITUTE", status: "DONE" }
  });

  return NextResponse.redirect(new URL(`/substitutions?absencePeriodId=${absencePeriodId}`, request.url), 303);
}
