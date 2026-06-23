import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ResetMode = "usage_only" | "schedules_too" | "master_data_too";

export async function POST(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => null);
  const mode = normalizeMode(body?.mode);
  const backupConfirmed = body?.backupConfirmed === true;
  const confirmationText = String(body?.confirmationText ?? "").trim();

  if (!mode) return jsonError("รูปแบบการเริ่มต้นระบบใหม่ไม่ถูกต้อง", 400);
  if (!backupConfirmed) return jsonError("ต้องยืนยันว่าได้สำรองข้อมูลแล้วก่อนเริ่มต้นระบบใหม่", 400);
  if (confirmationText !== "RESET") return jsonError("กรุณาพิมพ์ RESET เพื่อยืนยัน", 400);

  const result = await prisma.$transaction(async (tx) => {
    const temporarySchedules = await tx.temporarySchedule.deleteMany();
    const swapRequests = await tx.swapRequest.deleteMany();
    const substitutions = await tx.substitution.deleteMany();
    const absencePeriods = await tx.absencePeriod.deleteMany();
    const teacherAbsences = await tx.teacherAbsence.deleteMany();

    let teachingSchedules = { count: 0 };
    let schoolTerms = { count: 0 };
    let users = { count: 0 };
    let teachers = { count: 0 };
    let rooms = { count: 0 };
    let subjects = { count: 0 };
    let departments = { count: 0 };

    if (mode === "schedules_too" || mode === "master_data_too") {
      teachingSchedules = await tx.teachingSchedule.deleteMany();
      schoolTerms = await tx.schoolTerm.deleteMany();
    }

    if (mode === "master_data_too") {
      users = await tx.user.deleteMany({ where: { role: { not: "ADMIN" } } });
      await tx.user.updateMany({ where: { role: "ADMIN" }, data: { teacherId: null } });
      teachers = await tx.teacher.deleteMany();
      rooms = await tx.room.deleteMany();
      subjects = await tx.subject.deleteMany();
      departments = await tx.department.deleteMany();
    }

    return {
      temporarySchedules: temporarySchedules.count,
      swapRequests: swapRequests.count,
      substitutions: substitutions.count,
      absencePeriods: absencePeriods.count,
      teacherAbsences: teacherAbsences.count,
      teachingSchedules: teachingSchedules.count,
      schoolTerms: schoolTerms.count,
      users: users.count,
      teachers: teachers.count,
      rooms: rooms.count,
      subjects: subjects.count,
      departments: departments.count
    };
  });

  return Response.json({
    ok: true,
    message: `เริ่มต้นระบบใหม่เรียบร้อยแล้ว (${modeLabel(mode)})`,
    result
  });
}

function normalizeMode(value: unknown): ResetMode | null {
  if (value === "usage_only" || value === "schedules_too" || value === "master_data_too") return value;
  return null;
}

function modeLabel(mode: ResetMode) {
  if (mode === "usage_only") return "ล้างเฉพาะข้อมูลการใช้งาน";
  if (mode === "schedules_too") return "ล้างข้อมูลการใช้งานและตารางสอน";
  return "เริ่มใหม่ทั้งหมดแต่เก็บบัญชีผู้ดูแลระบบ";
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}
