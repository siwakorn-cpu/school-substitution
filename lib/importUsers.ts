import { parse } from "csv-parse/sync";
import { hashPassword } from "@/lib/auth";
import { readFirstWorksheet } from "@/lib/excel";
import { prisma } from "@/lib/prisma";

type UserImportRow = {
  username?: string;
  password?: string;
  role?: string;
  teacher_code?: string;
  is_active?: string;
};

export async function parseUserFile(file: File): Promise<UserImportRow[]> {
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
  return readFirstWorksheet<UserImportRow>(bytes);
}

export async function importUsers(rows: UserImportRow[]) {
  const errors: string[] = [];
  let imported = 0;

  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    const username = String(row.username ?? "").trim();
    const password = String(row.password ?? "").trim();
    const role = normalizeRole(row.role);
    const teacherCode = String(row.teacher_code ?? "").trim();
    const isActive = normalizeActive(row.is_active);

    if (!username || password.length < 6) {
      errors.push(`แถว ${line}: ต้องมี username และ password อย่างน้อย 6 ตัวอักษร`);
      continue;
    }

    const teacher = teacherCode ? await prisma.teacher.findUnique({ where: { code: teacherCode } }) : null;
    if (teacherCode && !teacher) {
      errors.push(`แถว ${line}: ไม่พบรหัสครู ${teacherCode}`);
      continue;
    }

    const existingTeacherUser = teacher
      ? await prisma.user.findFirst({
          where: {
            teacherId: teacher.id,
            username: { not: username }
          }
        })
      : null;
    if (existingTeacherUser) {
      errors.push(`แถว ${line}: รหัสครู ${teacherCode} ถูกผูกกับผู้ใช้อื่นแล้ว`);
      continue;
    }

    await prisma.user.upsert({
      where: { username },
      update: {
        passwordHash: await hashPassword(password),
        role,
        teacherId: teacher?.id ?? null,
        isActive
      },
      create: {
        username,
        passwordHash: await hashPassword(password),
        role,
        teacherId: teacher?.id,
        isActive
      }
    });
    imported += 1;
  }

  return { imported, errors };
}

function normalizeRole(value: unknown) {
  const role = String(value ?? "TEACHER").trim().toUpperCase();
  if (role === "ครู") return "TEACHER";
  if (role === "ADMIN" || role === "PERSONNEL" || role === "HEAD" || role === "DEPT_REP" || role === "TEACHER") {
    return role;
  }
  return "TEACHER";
}

function normalizeActive(value: unknown) {
  const text = String(value ?? "TRUE").trim().toLowerCase();
  return !(text === "false" || text === "0" || text === "inactive" || text === "ปิดใช้งาน");
}
