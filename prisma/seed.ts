import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.temporarySchedule.deleteMany();
  await prisma.swapRequest.deleteMany();
  await prisma.substitution.deleteMany();
  await prisma.absencePeriod.deleteMany();
  await prisma.teacherAbsence.deleteMany();
  await prisma.teachingSchedule.deleteMany();
  await prisma.user.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.department.deleteMany();
  await prisma.room.deleteMany();
  await prisma.subject.deleteMany();

  const departments = await Promise.all(
    ["คณิตศาสตร์", "วิทยาศาสตร์", "ภาษาไทย", "ภาษาอังกฤษ", "สังคมศึกษา"].map((name) =>
      prisma.department.create({ data: { name } })
    )
  );

  const teachers = await Promise.all([
    prisma.teacher.create({ data: { code: "T001", name: "ครูอรทัย ใจดี", departmentId: departments[0].id } }),
    prisma.teacher.create({ data: { code: "T002", name: "ครูสมชาย รักเรียน", departmentId: departments[0].id } }),
    prisma.teacher.create({ data: { code: "T003", name: "ครูวิภา แสงดาว", departmentId: departments[1].id } }),
    prisma.teacher.create({ data: { code: "T004", name: "ครูปกรณ์ ทดลอง", departmentId: departments[1].id } }),
    prisma.teacher.create({ data: { code: "T005", name: "ครูมาลี ภาษา", departmentId: departments[2].id } }),
    prisma.teacher.create({ data: { code: "T006", name: "ครูจอห์น English", departmentId: departments[3].id } }),
    prisma.teacher.create({ data: { code: "T007", name: "ครูธนา เมืองไทย", departmentId: departments[4].id } })
  ]);

  await prisma.user.create({
    data: {
      username: "admin",
      passwordHash: await bcrypt.hash("admin1234", 10),
      role: Role.ADMIN
    }
  });

  await prisma.user.create({
    data: {
      username: "headmath",
      passwordHash: await bcrypt.hash("teacher1234", 10),
      role: Role.HEAD,
      teacherId: teachers[0].id
    }
  });

  await prisma.user.create({
    data: {
      username: "teacher",
      passwordHash: await bcrypt.hash("teacher1234", 10),
      role: Role.TEACHER,
      teacherId: teachers[2].id
    }
  });

  const rooms = await Promise.all(
    ["ม.1/1", "ม.1/2", "ม.2/1", "ม.2/2", "ม.3/1"].map((name) =>
      prisma.room.create({ data: { name, type: "CLASSROOM" } })
    )
  );
  const lab = await prisma.room.create({ data: { name: "ห้องวิทย์ 1", type: "SPECIAL" } });
  const computer = await prisma.room.create({ data: { name: "ห้องคอมพิวเตอร์", type: "SPECIAL" } });

  const subjects = await Promise.all(
    ["คณิตศาสตร์", "วิทยาศาสตร์", "ภาษาไทย", "ภาษาอังกฤษ", "สังคมศึกษา"].map((name) =>
      prisma.subject.create({ data: { name } })
    )
  );

  const scheduleRows = [
    [0, 1, 1, 0, 0, null],
    [0, 2, 2, 2, 0, null],
    [1, 1, 1, 1, 0, null],
    [1, 3, 2, 3, 0, null],
    [2, 1, 2, 2, 1, lab.id],
    [2, 4, 4, 4, 1, lab.id],
    [3, 2, 1, 0, 1, computer.id],
    [3, 5, 3, 1, 1, lab.id],
    [4, 1, 3, 3, 2, null],
    [5, 2, 3, 4, 3, null],
    [6, 3, 1, 0, 4, null]
  ] as const;

  for (const [teacherIndex, dayOfWeek, period, roomIndex, subjectIndex, specialRoomId] of scheduleRows) {
    await prisma.teachingSchedule.create({
      data: {
        teacherId: teachers[teacherIndex].id,
        dayOfWeek,
        period,
        classRoomId: rooms[roomIndex].id,
        subjectId: subjects[subjectIndex].id,
        specialRoomId,
        term: "1/2569"
      }
    });
  }
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
