import { parse } from "csv-parse/sync";
import { classRoomsOverlap } from "@/lib/combinedRooms";
import { readFirstWorksheet } from "@/lib/excel";
import { prisma } from "@/lib/prisma";

export type ImportPreviewRow = {
  teacher_code: string;
  day: string;
  period: string;
  class_room: string;
  subject_code?: string;
  subject: string;
  special_room?: string;
  room_building?: string;
};

export type ImportResult = {
  imported: number;
  errors: string[];
};

const dayMap = new Map([
  ["อาทิตย์", 0],
  ["จันทร์", 1],
  ["อังคาร", 2],
  ["พุธ", 3],
  ["พฤหัสบดี", 4],
  ["พฤหัส", 4],
  ["ศุกร์", 5],
  ["เสาร์", 6]
]);

export async function parseScheduleFile(file: File): Promise<ImportPreviewRow[]> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) {
    return parse(bytes, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  }

  if (!name.endsWith(".xlsx")) throw new Error("รองรับเฉพาะไฟล์ .csv และ .xlsx");
  return readFirstWorksheet<ImportPreviewRow>(bytes);
}

export async function importSchedules(rows: ImportPreviewRow[], term = "1/2569"): Promise<ImportResult> {
  const errors: string[] = [];
  let imported = 0;

  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    const teacherCode = String(row.teacher_code ?? "").trim();
    const dayOfWeek = normalizeDay(row.day);
    const periods = normalizePeriods(row.period);
    const classRoomName = String(row.class_room ?? "").trim();
    const subjectCode = String(row.subject_code ?? "").trim();
    const subjectName = String(row.subject ?? "").trim();
    const specialRoomName = String(row.room_building ?? row.special_room ?? "").trim();

    if (!teacherCode || dayOfWeek === null || periods.length === 0 || !classRoomName || !subjectName) {
      errors.push(`แถว ${line}: ข้อมูลไม่ครบหรือรูปแบบวัน/คาบไม่ถูกต้อง`);
      continue;
    }

    const teacher = await prisma.teacher.findUnique({ where: { code: teacherCode } });
    if (!teacher) {
      errors.push(`แถว ${line}: ไม่พบรหัสครู ${teacherCode}`);
      continue;
    }

    const classRoom = await prisma.room.upsert({
      where: { name: classRoomName },
      update: {},
      create: { name: classRoomName, type: "CLASSROOM" }
    });
    const subject = await prisma.subject.upsert({
      where: { name: subjectName },
      update: subjectCode ? { code: subjectCode } : {},
      create: { name: subjectName, code: subjectCode || null }
    });
    const specialRoom = specialRoomName
      ? await prisma.room.upsert({
          where: { name: specialRoomName },
          update: {},
          create: { name: specialRoomName, type: "SPECIAL" }
        })
      : null;

    for (const period of periods) {
      const slotSchedules = await prisma.teachingSchedule.findMany({
        where: { dayOfWeek, period, term },
        include: { classRoom: true }
      });
      const teacherConflict = slotSchedules.find((item) => item.teacherId === teacher.id);
      // ห้องควบ เช่น "6/1,2" ชนกับ "6/1" เพราะเป็นนักเรียนกลุ่มเดียวกัน แต่ "6/1" กับ "6/2" (วิชาแยกเรียน) ไม่ชน
      const classConflict = slotSchedules.find((item) => classRoomsOverlap(item.classRoom.name, classRoomName));
      const specialConflict = specialRoom
        ? slotSchedules.find((item) => item.specialRoomId === specialRoom.id)
        : null;

      if (teacherConflict || classConflict || specialConflict) {
        errors.push(`แถว ${line}: ตารางชนกับข้อมูลเดิมในคาบ ${period}`);
        continue;
      }

      await prisma.teachingSchedule.create({
        data: {
          teacherId: teacher.id,
          dayOfWeek,
          period,
          classRoomId: classRoom.id,
          subjectId: subject.id,
          specialRoomId: specialRoom?.id,
          term
        }
      });
      imported += 1;
    }
  }

  return { imported, errors };
}

function normalizeDay(value: unknown) {
  const text = String(value ?? "").trim();
  const numeric = Number(text);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) return numeric;
  return dayMap.get(text) ?? null;
}

export function normalizePeriods(value: unknown) {
  const text = String(value ?? "")
    .trim()
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll(" ", "");

  if (!text) return [];

  const rangeMatch = text.match(/^(\d{1,2})-(\d{1,2})$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (!isValidPeriod(start) || !isValidPeriod(end) || start > end) return [];
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  const parts = text.split(/[,+/、，]/).filter(Boolean);
  const periods = parts.map(Number);
  if (periods.length === 0 || periods.some((period) => !isValidPeriod(period))) return [];
  return [...new Set(periods)].sort((a, b) => a - b);
}

function isValidPeriod(period: number) {
  return Number.isInteger(period) && period >= 1 && period <= 10;
}
