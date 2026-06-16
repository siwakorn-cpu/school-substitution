import { parse } from "csv-parse/sync";
import { readFirstWorksheet } from "@/lib/excel";
import { prisma } from "@/lib/prisma";

type TeacherImportRow = {
  teacher_code?: string;
  code?: string;
  name?: string;
  teacher_name?: string;
  department?: string;
  department_name?: string;
  status?: string;
};

export async function parseTeacherFile(file: File): Promise<TeacherImportRow[]> {
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
  return readFirstWorksheet<TeacherImportRow>(bytes);
}

export async function importTeachers(rows: TeacherImportRow[]) {
  const errors: string[] = [];
  let imported = 0;

  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    const code = String(row.teacher_code || row.code || "").trim();
    const name = String(row.teacher_name || row.name || "").trim();
    const departmentName = String(row.department || row.department_name || "").trim();
    const statusText = String(row.status || "ACTIVE").trim().toUpperCase();
    const status = statusText === "INACTIVE" || statusText === "ปิดใช้งาน" ? "INACTIVE" : "ACTIVE";

    if (!code || !name || !departmentName) {
      errors.push(`แถว ${line}: ต้องมีรหัสครู ชื่อครู และกลุ่มสาระ`);
      continue;
    }

    const department = await prisma.department.upsert({
      where: { name: departmentName },
      update: {},
      create: { name: departmentName }
    });

    await prisma.teacher.upsert({
      where: { code },
      update: {
        name,
        departmentId: department.id,
        status
      },
      create: {
        code,
        name,
        departmentId: department.id,
        status
      }
    });
    imported += 1;
  }

  return { imported, errors };
}
