import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { importTeachers, parseTeacherFile } from "@/lib/importTeachers";

export async function POST(request: Request) {
  await requireAdmin();
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.redirect(new URL("/data-upload?teacherError=ไม่พบไฟล์รายชื่อครู", request.url), 303);
  }

  let rows;
  try {
    rows = await parseTeacherFile(file);
  } catch {
    return NextResponse.redirect(
      new URL("/data-upload?teacherError=ไฟล์รายชื่อครูไม่ถูกต้องหรือไม่รองรับ", request.url),
      303
    );
  }
  const result = await importTeachers(rows);

  if (result.errors.length > 0) {
    const message = encodeURIComponent(result.errors.slice(0, 8).join(" | "));
    return NextResponse.redirect(
      new URL(`/data-upload?teacherImported=${result.imported}&teacherError=${message}`, request.url),
      303
    );
  }

  return NextResponse.redirect(new URL(`/data-upload?teacherImported=${result.imported}`, request.url), 303);
}
