import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Mode = "replace" | "merge";

// Collections in parent-first order so foreign keys resolve when inserting.
const INSERT_ORDER = [
  "departments",
  "rooms",
  "subjects",
  "schoolTerms",
  "rolePermissions",
  "teachers",
  "users",
  "teachingSchedules",
  "teacherAbsences",
  "absencePeriods",
  "substitutions",
  "swapRequests",
  "temporarySchedules"
] as const;

type Collection = (typeof INSERT_ORDER)[number];

// Fields stored as DateTime that arrive from JSON as ISO strings.
const DATE_FIELDS: Record<Collection, string[]> = {
  departments: [],
  rooms: [],
  subjects: [],
  schoolTerms: ["createdAt", "updatedAt"],
  rolePermissions: ["updatedAt"],
  teachers: ["createdAt", "updatedAt"],
  users: ["createdAt", "updatedAt"],
  teachingSchedules: ["createdAt"],
  teacherAbsences: ["date", "createdAt"],
  absencePeriods: [],
  substitutions: ["date", "createdAt"],
  swapRequests: ["date", "toDate", "createdAt", "updatedAt"],
  temporarySchedules: ["date", "createdAt"]
};

// Minimal shape shared by every Prisma model delegate we touch.
type AnyDelegate = {
  createMany: (args: { data: Record<string, unknown>[] }) => Promise<{ count: number }>;
  deleteMany: (args?: Record<string, unknown>) => Promise<{ count: number }>;
  findMany: (args: { select: { id: true } }) => Promise<{ id: string }[]>;
};

function delegate(tx: Prisma.TransactionClient, collection: Collection): AnyDelegate {
  const map: Record<Collection, unknown> = {
    departments: tx.department,
    rooms: tx.room,
    subjects: tx.subject,
    schoolTerms: tx.schoolTerm,
    rolePermissions: tx.rolePermission,
    teachers: tx.teacher,
    users: tx.user,
    teachingSchedules: tx.teachingSchedule,
    teacherAbsences: tx.teacherAbsence,
    absencePeriods: tx.absencePeriod,
    substitutions: tx.substitution,
    swapRequests: tx.swapRequest,
    temporarySchedules: tx.temporarySchedule
  };
  return map[collection] as AnyDelegate;
}

function normalizeRows(collection: Collection, rows: unknown): Record<string, unknown>[] {
  if (!Array.isArray(rows)) return [];
  const dateFields = DATE_FIELDS[collection];
  return rows.map((raw) => {
    const row = { ...(raw as Record<string, unknown>) };
    for (const field of dateFields) {
      if (row[field] != null) row[field] = new Date(row[field] as string);
    }
    return row;
  });
}

export async function POST(request: Request) {
  await requireAdmin();

  const formData = await request.formData();
  const file = formData.get("file");
  const mode = normalizeMode(formData.get("mode"));
  const confirmationText = String(formData.get("confirmationText") ?? "").trim();

  if (!mode) return jsonError("รูปแบบการกู้คืนไม่ถูกต้อง", 400);
  if (!(file instanceof File)) return jsonError("ไม่พบไฟล์สำรองข้อมูล", 400);
  if (mode === "replace" && confirmationText !== "RESTORE") {
    return jsonError("กรุณาพิมพ์ RESTORE เพื่อยืนยันการแทนที่ข้อมูลทั้งหมด", 400);
  }

  let backup: { metadata?: { app?: string; formatVersion?: number }; data?: Record<string, unknown> };
  try {
    backup = JSON.parse(await file.text());
  } catch {
    return jsonError("ไฟล์ไม่ใช่ JSON ที่ถูกต้อง", 400);
  }

  if (backup?.metadata?.app !== "school-substitution") {
    return jsonError("ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลของระบบนี้", 400);
  }
  if (backup?.metadata?.formatVersion !== 1) {
    return jsonError(`ไม่รองรับ formatVersion ${backup?.metadata?.formatVersion ?? "?"}`, 400);
  }
  if (!backup.data || typeof backup.data !== "object") {
    return jsonError("ไฟล์สำรองข้อมูลไม่มีส่วน data", 400);
  }

  const data = backup.data;
  const prepared = INSERT_ORDER.map((collection) => ({
    collection,
    rows: normalizeRows(collection, data[collection])
  }));

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const counts: Record<string, number> = {};

        if (mode === "replace") {
          // Delete children-first (reverse of insert order) to satisfy FKs.
          for (const collection of [...INSERT_ORDER].reverse()) {
            await delegate(tx, collection).deleteMany({});
          }
        }

        for (const { collection, rows } of prepared) {
          if (rows.length === 0) {
            counts[collection] = 0;
            continue;
          }
          const target = delegate(tx, collection);
          let toCreate = rows;
          if (mode === "merge") {
            // Only insert records whose id is not already present (never overwrite).
            const existing = new Set((await target.findMany({ select: { id: true } })).map((row) => row.id));
            toCreate = rows.filter((row) => !existing.has(String(row.id)));
          }
          const created = toCreate.length > 0 ? await target.createMany({ data: toCreate }) : { count: 0 };
          counts[collection] = created.count;
        }

        return counts;
      },
      { timeout: 30000, maxWait: 30000 }
    );

    const total = Object.values(result).reduce((sum, count) => sum + count, 0);
    return Response.json({
      ok: true,
      message:
        mode === "replace"
          ? `กู้คืนข้อมูลแบบแทนที่ทั้งหมดเรียบร้อย (${total} รายการ)`
          : `กู้คืนข้อมูลแบบเติมส่วนที่ขาดเรียบร้อย (เพิ่ม ${total} รายการ)`,
      mode,
      result
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "ไม่ทราบสาเหตุ";
    return jsonError(`กู้คืนข้อมูลไม่สำเร็จ: ${detail}`, 400);
  }
}

function normalizeMode(value: FormDataEntryValue | null): Mode | null {
  const mode = String(value ?? "");
  return mode === "replace" || mode === "merge" ? mode : null;
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}
