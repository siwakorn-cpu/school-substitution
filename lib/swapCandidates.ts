import { prisma } from "@/lib/prisma";

type ScheduleWithDetails = Awaited<ReturnType<typeof prisma.teachingSchedule.findFirstOrThrow>> & {
  teacher: { id: string; name: string };
  classRoom: { id: string; name: string };
  subject: { id: string; name: string };
  specialRoom: { id: string; name: string } | null;
};

export async function getSwapCandidates(absencePeriodId: string) {
  const absencePeriod = await prisma.absencePeriod.findUnique({
    where: { id: absencePeriodId },
    include: {
      absence: true,
      schedule: {
        include: {
          teacher: true,
          classRoom: true,
          subject: true,
          specialRoom: true
        }
      }
    }
  });
  if (!absencePeriod) return [];

  const source = absencePeriod.schedule;
  if (!source.subject.requiresSubstitution) return [];

  // Activity periods (ชุมนุม / ลูกเสือ) cannot be swapped by anyone.
  const activityPeriods = await prisma.activityPeriod.findMany();
  const activitySlots = new Set(activityPeriods.map((activity) => `${activity.dayOfWeek}-${activity.period}`));
  if (activitySlots.has(`${source.dayOfWeek}-${source.period}`)) return [];

  const allSchedules = await prisma.teachingSchedule.findMany({
    where: {
      term: source.term,
      classRoomId: source.classRoomId,
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
    if (!target.subject.requiresSubstitution) continue;
    // Skip target slots that fall on an activity period.
    if (activitySlots.has(`${target.dayOfWeek}-${target.period}`)) continue;

    const requesterBusyAtTargetPeriod = await prisma.teachingSchedule.findFirst({
      where: {
        teacherId: source.teacherId,
        dayOfWeek: target.dayOfWeek,
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
        dayOfWeek: target.dayOfWeek,
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
          dayOfWeek: target.dayOfWeek,
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

    candidates.push({
      ...target,
      splitDoublePeriod: (await isPartOfDoublePeriod(source)) || (await isPartOfDoublePeriod(target)),
      warnings: buildSwapWarnings(source, target)
    });
  }

  return candidates;
}

export async function validateSwapCandidate(absencePeriodId: string, toScheduleId: string) {
  const candidates = await getSwapCandidates(absencePeriodId);
  return candidates.find((item) => item.id === toScheduleId) ?? null;
}

async function isPartOfDoublePeriod(schedule: ScheduleWithDetails) {
  const adjacentPeriods = [schedule.period - 1, schedule.period + 1].filter((period) => period >= 1 && period <= 10);
  const adjacent = await prisma.teachingSchedule.findFirst({
    where: {
      id: { not: schedule.id },
      teacherId: schedule.teacherId,
      classRoomId: schedule.classRoomId,
      subjectId: schedule.subjectId,
      specialRoomId: schedule.specialRoomId,
      dayOfWeek: schedule.dayOfWeek,
      period: { in: adjacentPeriods },
      term: schedule.term
    }
  });
  return Boolean(adjacent);
}

function buildSwapWarnings(source: ScheduleWithDetails, target: ScheduleWithDetails) {
  const warnings: string[] = [];
  if (source.specialRoomId !== target.specialRoomId) {
    warnings.push("มีการย้ายการใช้ห้อง/อาคารของรายวิชา ต้องตรวจความเหมาะสมของห้อง");
  }
  if (source.dayOfWeek !== target.dayOfWeek) {
    warnings.push("เป็นการสลับคาบข้ามวัน ระบบจะสร้างตารางชั่วคราวให้ทั้งสองวันในสัปดาห์เดียวกัน");
  }
  return warnings;
}
