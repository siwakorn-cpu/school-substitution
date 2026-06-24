import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  const today = startOfToday();
  const tomorrow = addDays(today, 1);

  const subjectCodes: Record<string, string> = {
    "คณิตศาสตร์": "ค21102",
    "วิทยาศาสตร์": "ว21102",
    "ภาษาไทย": "ท21102",
    "ภาษาอังกฤษ": "อ21102",
    "สังคมศึกษา": "ส21102"
  };
  for (const [name, code] of Object.entries(subjectCodes)) {
    await prisma.subject.updateMany({ where: { name }, data: { code } });
  }

  const teachers = await prisma.teacher.findMany();
  const byCode = new Map(teachers.map((teacher) => [teacher.code, teacher]));
  const schedules = await prisma.teachingSchedule.findMany();
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("ไม่พบบัญชี admin กรุณารัน npm run db:seed ก่อน");
  const adminId = admin.id;

  function scheduleFor(code: string, period: number) {
    const teacher = byCode.get(code);
    if (!teacher) throw new Error(`ไม่พบครู code=${code}`);
    const schedule = schedules.find((s) => s.teacherId === teacher.id && s.period === period);
    if (!schedule) throw new Error(`ไม่พบคาบสอนของครู ${code} คาบ ${period}`);
    return { teacher, schedule };
  }

  async function createSwap(opts: {
    requesterCode: string;
    requesterPeriod: number;
    targetCode: string;
    targetPeriod: number;
    absenceType: "OFFICIAL" | "PERSONAL";
    status: "PENDING" | "APPROVED" | "REJECTED";
    note: string;
  }) {
    const { teacher: requester, schedule: fromSchedule } = scheduleFor(opts.requesterCode, opts.requesterPeriod);
    const { teacher: target, schedule: toSchedule } = scheduleFor(opts.targetCode, opts.targetPeriod);

    const absence = await prisma.teacherAbsence.create({
      data: { teacherId: requester.id, date: today, type: opts.absenceType, note: opts.note, createdById: adminId }
    });
    const period = await prisma.absencePeriod.create({
      data: {
        absenceId: absence.id,
        scheduleId: fromSchedule.id,
        period: fromSchedule.period,
        actionType: "SWAP",
        status: opts.status === "APPROVED" ? "DONE" : "PENDING"
      }
    });
    await prisma.swapRequest.create({
      data: {
        absencePeriodId: period.id,
        requesterTeacherId: requester.id,
        targetTeacherId: target.id,
        date: today,
        toDate: tomorrow,
        fromScheduleId: fromSchedule.id,
        toScheduleId: toSchedule.id,
        status: opts.status,
        requestedById: adminId,
        approvedById: opts.status !== "PENDING" ? adminId : null,
        note: opts.note
      }
    });
  }

  async function createSubstitution(opts: {
    absentCode: string;
    absentPeriod: number;
    substituteCode: string;
    note: string;
  }) {
    const { teacher: absentTeacher, schedule } = scheduleFor(opts.absentCode, opts.absentPeriod);
    const substitute = byCode.get(opts.substituteCode);
    if (!substitute) throw new Error(`ไม่พบครูเข้าแทน code=${opts.substituteCode}`);

    const absence = await prisma.teacherAbsence.create({
      data: { teacherId: absentTeacher.id, date: today, type: "OFFICIAL", note: opts.note, createdById: adminId }
    });
    const period = await prisma.absencePeriod.create({
      data: {
        absenceId: absence.id,
        scheduleId: schedule.id,
        period: schedule.period,
        actionType: "SUBSTITUTE",
        status: "DONE"
      }
    });
    await prisma.substitution.create({
      data: {
        absencePeriodId: period.id,
        originalTeacherId: absentTeacher.id,
        substituteTeacherId: substitute.id,
        date: today,
        period: schedule.period,
        classRoomId: schedule.classRoomId,
        subjectId: schedule.subjectId,
        specialRoomId: schedule.specialRoomId,
        assignedById: adminId,
        note: opts.note
      }
    });
  }

  await createSwap({
    requesterCode: "T002",
    requesterPeriod: 2,
    targetCode: "T003",
    targetPeriod: 4,
    absenceType: "PERSONAL",
    status: "PENDING",
    note: "ตัวอย่าง: รออนุมัติสลับคาบ"
  });
  await createSwap({
    requesterCode: "T006",
    requesterPeriod: 1,
    targetCode: "T007",
    targetPeriod: 1,
    absenceType: "OFFICIAL",
    status: "APPROVED",
    note: "ตัวอย่าง: อนุมัติสลับคาบแล้ว"
  });
  await createSwap({
    requesterCode: "T005",
    requesterPeriod: 3,
    targetCode: "T004",
    targetPeriod: 1,
    absenceType: "PERSONAL",
    status: "REJECTED",
    note: "ตัวอย่าง: ไม่อนุมัติสลับคาบ"
  });

  await createSubstitution({
    absentCode: "T001",
    absentPeriod: 2,
    substituteCode: "T002",
    note: "ตัวอย่างเข้าแทน 1"
  });
  await createSubstitution({
    absentCode: "T003",
    absentPeriod: 2,
    substituteCode: "T007",
    note: "ตัวอย่างเข้าแทน 2"
  });

  console.log("สร้างข้อมูลตัวอย่างของวันนี้เรียบร้อย");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
