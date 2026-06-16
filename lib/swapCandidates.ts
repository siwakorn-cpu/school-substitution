import { prisma } from "@/lib/prisma";

export async function getSwapCandidates(absencePeriodId: string) {
  const absencePeriod = await prisma.absencePeriod.findUnique({
    where: { id: absencePeriodId },
    include: { absence: true, schedule: true }
  });
  if (!absencePeriod) return [];

  const source = absencePeriod.schedule;
  const allSchedules = await prisma.teachingSchedule.findMany({
    where: {
      dayOfWeek: source.dayOfWeek,
      term: source.term,
      id: { not: source.id }
    },
    include: {
      teacher: { include: { department: true } },
      classRoom: true,
      subject: true,
      specialRoom: true
    },
    orderBy: [{ period: "asc" }]
  });

  const candidates = [];

  for (const target of allSchedules) {
    if (target.teacherId === source.teacherId) continue;

    const requesterBusyAtTargetPeriod = await prisma.teachingSchedule.findFirst({
      where: {
        teacherId: source.teacherId,
        dayOfWeek: source.dayOfWeek,
        period: target.period,
        term: source.term,
        id: { not: source.id }
      }
    });
    if (requesterBusyAtTargetPeriod) continue;

    const targetBusyAtSourcePeriod = await prisma.teachingSchedule.findFirst({
      where: {
        teacherId: target.teacherId,
        dayOfWeek: source.dayOfWeek,
        period: source.period,
        term: source.term,
        id: { not: target.id }
      }
    });
    if (targetBusyAtSourcePeriod) continue;

    const targetRoomConflictAtSource = await prisma.teachingSchedule.findFirst({
      where: {
        classRoomId: target.classRoomId,
        dayOfWeek: source.dayOfWeek,
        period: source.period,
        term: source.term,
        id: { not: target.id }
      }
    });
    if (targetRoomConflictAtSource && targetRoomConflictAtSource.id !== source.id) continue;

    const sourceRoomConflictAtTarget = await prisma.teachingSchedule.findFirst({
      where: {
        classRoomId: source.classRoomId,
        dayOfWeek: source.dayOfWeek,
        period: target.period,
        term: source.term,
        id: { not: source.id }
      }
    });
    if (sourceRoomConflictAtTarget && sourceRoomConflictAtTarget.id !== target.id) continue;

    if (source.specialRoomId) {
      const sourceSpecialConflict = await prisma.teachingSchedule.findFirst({
        where: {
          specialRoomId: source.specialRoomId,
          dayOfWeek: source.dayOfWeek,
          period: target.period,
          term: source.term,
          id: { not: source.id }
        }
      });
      if (sourceSpecialConflict && sourceSpecialConflict.id !== target.id) continue;
    }

    if (target.specialRoomId) {
      const targetSpecialConflict = await prisma.teachingSchedule.findFirst({
        where: {
          specialRoomId: target.specialRoomId,
          dayOfWeek: source.dayOfWeek,
          period: source.period,
          term: source.term,
          id: { not: target.id }
        }
      });
      if (targetSpecialConflict && targetSpecialConflict.id !== source.id) continue;
    }

    candidates.push(target);
  }

  return candidates;
}
