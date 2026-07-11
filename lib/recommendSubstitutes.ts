import { prisma } from "@/lib/prisma";
import {
  buildYearLongCombinedGroups,
  canCoverCombinedClassRoom,
  departmentAllowsCombinedCover
} from "@/lib/combinedRooms";

export type SubstituteRecommendation = {
  teacherId: string;
  teacherCode: string;
  teacherName: string;
  departmentName: string;
  score: number;
  substitutionCount: number;
  reasons: string[];
  warnings: string[];
  /** ครูติดสอน/กำลังแทนห้องในกลุ่มควบเดียวกันในคาบนี้ — UI แสดงเป็นตัวเลือกคุมควบแยกต่างหาก */
  coversCombinedRoom: boolean;
  /** ชื่อห้องที่ครูคนนี้สอนหรือกำลังแทนอยู่ในคาบเดียวกัน เช่น ["ม.5/5"] */
  coverRoomNames: string[];
};

export async function recommendSubstitutes(
  absencePeriodId: string,
  options: { departmentId?: string | null } = {}
): Promise<SubstituteRecommendation[]> {
  const absencePeriod = await prisma.absencePeriod.findUnique({
    where: { id: absencePeriodId },
    include: {
      absence: { include: { teacher: { include: { department: true } } } },
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

  const classRooms = await prisma.room.findMany({
    where: { type: "CLASSROOM" },
    select: { name: true }
  });
  const yearLongGroups = buildYearLongCombinedGroups(classRooms.map((room) => room.name));
  const allowCombinedCover = departmentAllowsCombinedCover(absence.teacher.department.name);

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
    const teacherAllowsCombinedCover = allowCombinedCover && departmentAllowsCombinedCover(teacher.department.name);
    const blockingBusySchedules = busySchedules.filter(
      (busySchedule) =>
        !(
          teacherAllowsCombinedCover &&
          canCoverCombinedClassRoom(busySchedule.classRoom.name, schedule.classRoom.name, yearLongGroups)
        )
    );
    if (blockingBusySchedules.length > 0) continue;

    // ครูที่รับสอนแทนห้องอื่นในคาบเดียวกันไปแล้ว ปกติถูกตัดออก
    // ยกเว้นห้องนั้นอยู่กลุ่มควบเดียวกัน (ภาษาต่างประเทศ) — รับแทนทั้ง 2 ห้องพร้อมกันได้
    const existingSubstitutions = await prisma.substitution.findMany({
      where: {
        substituteTeacherId: teacher.id,
        date: absence.date,
        period: schedule.period,
        absencePeriodId: { not: absencePeriod.id }
      }
    });
    let substitutedSiblingRoomNames: string[] = [];
    if (existingSubstitutions.length > 0) {
      if (!teacherAllowsCombinedCover) continue;
      const substitutedRooms = await prisma.room.findMany({
        where: { id: { in: existingSubstitutions.map((item) => item.classRoomId) } }
      });
      const roomById = new Map(substitutedRooms.map((room) => [room.id, room]));
      const allSiblingRooms = existingSubstitutions.every((item) => {
        const room = roomById.get(item.classRoomId);
        return room ? canCoverCombinedClassRoom(room.name, schedule.classRoom.name, yearLongGroups) : false;
      });
      if (!allSiblingRooms) continue;
      substitutedSiblingRoomNames = [...new Set(existingSubstitutions.map((item) => roomById.get(item.classRoomId)!.name))];
    }

    const coversCombinedRoom = busySchedules.length > 0 || substitutedSiblingRoomNames.length > 0;
    const coverRoomNames = [
      ...new Set([...busySchedules.map((item) => item.classRoom.name), ...substitutedSiblingRoomNames])
    ];

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

    let score = coversCombinedRoom ? 35 : 45;
    const reasons = [
      coversCombinedRoom ? `สอน/คุมห้องควบกลุ่มเดียวกันในคาบนี้ (${coverRoomNames.join(", ")})` : "ว่างในคาบนี้"
    ];
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
      warnings,
      coversCombinedRoom,
      coverRoomNames
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
