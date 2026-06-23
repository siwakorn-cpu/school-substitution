import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";
import { getTermOptions } from "@/lib/terms";

const REDIRECT = "/settings/subjects";

function redirectWith(request: Request, key: "levelMeetingMessage" | "levelMeetingError", message: string) {
  const params = new URLSearchParams({ [key]: message });
  return redirectTo(request, `${REDIRECT}?${params.toString()}`);
}

function uniqueStrings(values: FormDataEntryValue[]) {
  return Array.from(new Set(values.map(String).map((value) => value.trim()).filter(Boolean)));
}

export async function POST(request: Request) {
  await requireAdmin();
  const formData = await request.formData();
  const level = Number(formData.get("level"));
  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const period = Number(formData.get("period"));
  const teacherIds = uniqueStrings(formData.getAll("teacherIds"));

  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > 6 ||
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 1 ||
    dayOfWeek > 5 ||
    !Number.isInteger(period) ||
    period < 1 ||
    period > 10
  ) {
    return redirectWith(request, "levelMeetingError", "ข้อมูลคาบประชุมระดับไม่ถูกต้อง");
  }

  const { currentTerm } = await getTermOptions();

  try {
    await prisma.$transaction(async (tx) => {
      const subject = await tx.subject.upsert({
        where: { name: `ประชุมระดับ ม.${level}` },
        create: {
          code: `LEVEL_M${level}`,
          name: `ประชุมระดับ ม.${level}`,
          requiresSubstitution: false
        },
        update: {
          code: `LEVEL_M${level}`,
          requiresSubstitution: false
        }
      });

      const room = await tx.room.upsert({
        where: { name: `ประชุมระดับ ม.${level}` },
        create: {
          name: `ประชุมระดับ ม.${level}`,
          type: "CLASSROOM",
          isActive: true
        },
        update: { isActive: true }
      });

      const meeting = await tx.levelMeeting.upsert({
        where: { level },
        create: { level, dayOfWeek, period },
        update: { dayOfWeek, period }
      });

      const existingAssignments = await tx.levelMeetingTeacher.findMany({
        where: { levelMeetingId: meeting.id }
      });
      const existingByTeacher = new Map(existingAssignments.map((assignment) => [assignment.teacherId, assignment]));
      const selectedTeacherSet = new Set(teacherIds);
      const removedAssignments = existingAssignments.filter((assignment) => !selectedTeacherSet.has(assignment.teacherId));

      for (const teacherId of teacherIds) {
        const currentAssignment = existingByTeacher.get(teacherId);
        const copiedSchedule = await tx.teachingSchedule.findFirst({
          where: {
            teacherId,
            term: currentTerm,
            subjectId: subject.id,
            classRoomId: room.id
          }
        });
        const allowedScheduleIds = [currentAssignment?.scheduleId, copiedSchedule?.id].filter(Boolean) as string[];
        const conflict = await tx.teachingSchedule.findFirst({
          where: {
            teacherId,
            dayOfWeek,
            period,
            term: currentTerm,
            ...(allowedScheduleIds.length > 0 ? { id: { notIn: allowedScheduleIds } } : {})
          },
          include: { subject: true }
        });

        if (conflict) {
          const teacher = await tx.teacher.findUnique({ where: { id: teacherId }, select: { name: true } });
          throw new Error(`${teacher?.name ?? "ครูที่เลือก"} มีคาบ ${conflict.subject.name} อยู่แล้วในคาบนี้`);
        }
      }

      const removedScheduleIds = removedAssignments.map((assignment) => assignment.scheduleId).filter(Boolean) as string[];
      if (removedScheduleIds.length > 0) {
        await tx.teachingSchedule.deleteMany({ where: { id: { in: removedScheduleIds } } });
      }
      if (removedAssignments.length > 0) {
        await tx.levelMeetingTeacher.deleteMany({ where: { id: { in: removedAssignments.map((assignment) => assignment.id) } } });
      }

      for (const teacherId of teacherIds) {
        const currentAssignment = existingByTeacher.get(teacherId);
        const copiedSchedule = await tx.teachingSchedule.findFirst({
          where: {
            teacherId,
            term: currentTerm,
            subjectId: subject.id,
            classRoomId: room.id
          }
        });
        let scheduleId = copiedSchedule?.id ?? currentAssignment?.scheduleId ?? null;
        const scheduleData = {
          teacherId,
          dayOfWeek,
          period,
          classRoomId: room.id,
          subjectId: subject.id,
          specialRoomId: null,
          term: currentTerm
        };

        if (scheduleId) {
          const existingSchedule = await tx.teachingSchedule.findUnique({ where: { id: scheduleId } });
          if (existingSchedule) {
            await tx.teachingSchedule.update({ where: { id: scheduleId }, data: scheduleData });
          } else {
            const created = await tx.teachingSchedule.create({ data: scheduleData });
            scheduleId = created.id;
          }
        } else {
          const created = await tx.teachingSchedule.create({ data: scheduleData });
          scheduleId = created.id;
        }

        await tx.levelMeetingTeacher.upsert({
          where: { levelMeetingId_teacherId: { levelMeetingId: meeting.id, teacherId } },
          create: { levelMeetingId: meeting.id, teacherId, scheduleId },
          update: { scheduleId }
        });
      }
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "ไม่ทราบสาเหตุ";
    return redirectWith(request, "levelMeetingError", `บันทึกคาบประชุมระดับไม่สำเร็จ: ${detail}`);
  }

  return redirectWith(request, "levelMeetingMessage", `บันทึกคาบประชุมระดับ ม.${level} เรียบร้อยแล้ว`);
}
