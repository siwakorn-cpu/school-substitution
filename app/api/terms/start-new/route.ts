import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type StartMode = "copy_schedule" | "blank_schedule";

export async function POST(request: Request) {
  const user = await requireAdmin();
  const body = await request.json().catch(() => null);

  const newTerm = String(body?.newTerm ?? "").trim();
  const sourceTerm = String(body?.sourceTerm ?? "").trim();
  const mode = normalizeMode(body?.mode);
  const backupConfirmed = body?.backupConfirmed === true;

  if (!backupConfirmed) {
    return jsonError("ต้องยืนยันว่าได้สำรองข้อมูลแล้วก่อนเริ่มภาคเรียนใหม่", 400);
  }
  if (!newTerm) {
    return jsonError("กรุณาระบุภาคเรียนใหม่", 400);
  }
  if (mode === "copy_schedule" && !sourceTerm) {
    return jsonError("กรุณาเลือกภาคเรียนต้นทาง", 400);
  }
  if (mode === "copy_schedule" && newTerm === sourceTerm) {
    return jsonError("ภาคเรียนใหม่ต้องไม่ซ้ำกับภาคเรียนต้นทาง", 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [existingTerm, existingSchedules] = await Promise.all([
        tx.schoolTerm.findUnique({ where: { name: newTerm } }),
        tx.teachingSchedule.count({ where: { term: newTerm } })
      ]);

      if (existingTerm || existingSchedules > 0) {
        throw new Error("ภาคเรียนนี้มีอยู่แล้ว");
      }

      let createdSchedules = 0;
      if (mode === "copy_schedule") {
        const sourceSchedules = await tx.teachingSchedule.findMany({
          where: { term: sourceTerm },
          select: {
            teacherId: true,
            dayOfWeek: true,
            period: true,
            classRoomId: true,
            subjectId: true,
            specialRoomId: true
          }
        });

        if (sourceSchedules.length === 0) {
          throw new Error("ไม่พบตารางสอนในภาคเรียนต้นทาง");
        }

        const created = await tx.teachingSchedule.createMany({
          data: sourceSchedules.map((schedule) => ({
            ...schedule,
            term: newTerm
          }))
        });
        createdSchedules = created.count;
      }

      await tx.schoolTerm.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false }
      });
      await tx.schoolTerm.create({
        data: {
          name: newTerm,
          isCurrent: true,
          sourceTerm: mode === "copy_schedule" ? sourceTerm : null,
          mode,
          createdById: user.id
        }
      });

      return { createdSchedules };
    });

    return Response.json({
      ok: true,
      message:
        mode === "copy_schedule"
          ? `เริ่มภาคเรียน ${newTerm} แล้ว และคัดลอกตารางสอน ${result.createdSchedules} รายการ`
          : `เริ่มภาคเรียน ${newTerm} แล้ว แบบตารางว่าง`
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "เริ่มภาคเรียนใหม่ไม่สำเร็จ", 400);
  }
}

function normalizeMode(value: unknown): StartMode {
  return value === "copy_schedule" ? "copy_schedule" : "blank_schedule";
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}
