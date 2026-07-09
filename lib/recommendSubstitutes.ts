import { prisma } from "@/lib/prisma";
import { canCoverPairedClassRoom } from "@/lib/combinedRooms";

export type SubstituteRecommendation = {
  teacherId: string;
  teacherCode: string;
  teacherName: string;
  departmentName: string;
  score: number;
  substitutionCount: number;
  reasons: string[];
  warnings: string[];
};

export async function recommendSubstitutes(
  absencePeriodId: string,
  options: { departmentId?: string | null } = {}
): Promise<SubstituteRecommendation[]> {
  const absencePeriod = await prisma.absencePeriod.findUnique({
    where: { id: absencePeriodId },
    include: {
      absence: { include: { teacher: true } },
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
  const currentSubstitution = await prisma.substitution.findUnique({
    where: { absencePeriodId }
  });

  const { absence, schedule } = absencePeriod;
  const teachers = await prisma.teacher.findMany({
    where: {
      status: "ACTIVE",
      id: { not: absence.teacherId },
      ...(options.departmentId ? { departmentId: options.departmentId } : {})
    },
    include: { department: true }
  });

  const recommendations: SubstituteRecommendation[] = [];

  for (const teacher of teachers) {
    const busySchedules = await prisma.teachingSchedule.findMany({
      where: {
        teacherId: teacher.id,
        dayOfWeek: schedule.dayOfWeek,
        period: schedule.period,
        term: schedule.term
      },
      include: { classRoom: true }
    });
    const blockingBusySchedules = busySchedules.filter(
      (busySchedule) => !canCoverPairedClassRoom(busySchedule.classRoom.name, schedule.classRoom.name)
    );
    if (blockingBusySchedules.length > 0) continue;
    const coversPairedRoom = busySchedules.length > 0;

    const alreadySubstituting = await prisma.substitution.findFirst({
      where: {
        substituteTeacherId: teacher.id,
        date: absence.date,
        period: schedule.period,
        absencePeriodId: { not: absencePeriod.id }
      }
    });
    if (alreadySubstituting) continue;

    const absentThatDay = await prisma.teacherAbsence.findFirst({
      where: { teacherId: teacher.id, date: absence.date }
    });
    if (absentThatDay) continue;

    const substitutionCount = await prisma.substitution.count({
      where: { substituteTeacherId: teacher.id, absencePeriodId: { not: absencePeriod.id } }
    });
    const teachingCountToday = await prisma.teachingSchedule.count({
      where: {
        teacherId: teacher.id,
        dayOfWeek: schedule.dayOfWeek,
        term: schedule.term
      }
    });
    const adjacent = await prisma.teachingSchedule.findMany({
      where: {
        teacherId: teacher.id,
        dayOfWeek: schedule.dayOfWeek,
        period: { in: [schedule.period - 1, schedule.period + 1].filter((p) => p >= 1 && p <= 10) },
        term: schedule.term
      }
    });

    let score = coversPairedRoom ? 35 : 45;
    const reasons = [coversPairedRoom ? "สอนห้องคู่ควบคาบเดียวกัน" : "ว่างในคาบนี้"];
    reasons.push(`วันนี้สอน ${teachingCountToday} คาบ`);
    const warnings: string[] = [];

    if (teacher.departmentId === absence.teacher.departmentId) {
      score += 30;
      reasons.push("อยู่กลุ่มสาระเดียวกัน");
    }

    if (currentSubstitution?.substituteTeacherId === teacher.id) {
      score += 5;
      reasons.push("ครูที่จัดไว้ปัจจุบัน");
    }

    const loadScore = Math.max(0, 25 - substitutionCount * 3);
    score += loadScore;
    reasons.push(`เคยเข้าแทน ${substitutionCount} คาบ`);

    if (adjacent.length === 0) {
      score += 20;
      reasons.push("ไม่มีคาบติดก่อน/หลัง");
    } else if (adjacent.length === 1) {
      score += 10;
      warnings.push("มีคาบติดกัน 1 ด้าน");
    } else {
      score -= 20;
      warnings.push("มีคาบติดทั้งก่อนและหลัง");
    }

    recommendations.push({
      teacherId: teacher.id,
      teacherCode: teacher.code,
      teacherName: teacher.name,
      departmentName: teacher.department.name,
      score,
      substitutionCount,
      reasons,
      warnings
    });
  }

  return recommendations.sort((a, b) => b.score - a.score || a.substitutionCount - b.substitutionCount);
}

export async function validateSubstitute(
  absencePeriodId: string,
  substituteTeacherId: string,
  options: { departmentId?: string | null } = {}
) {
  const optionsList = await recommendSubstitutes(absencePeriodId, options);
  return optionsList.some((item) => item.teacherId === substituteTeacherId);
}
