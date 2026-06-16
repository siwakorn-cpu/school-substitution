import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { importSchedules, parseScheduleFile } from "@/lib/importSchedules";

export async function POST(request: Request) {
  await requireAdmin();
  const formData = await request.formData();
  const file = formData.get("file");
  const term = String(formData.get("term") ?? "1/2569").trim();

  if (!(file instanceof File)) {
    return NextResponse.redirect(new URL("/data-upload?error=ไม่พบไฟล์", request.url), 303);
  }

  let rows;
  try {
    rows = await parseScheduleFile(file);
  } catch {
    return NextResponse.redirect(new URL("/data-upload?error=ไฟล์ไม่ถูกต้องหรือไม่รองรับ", request.url), 303);
  }
  const result = await importSchedules(rows, term);

  if (result.errors.length > 0) {
    const message = encodeURIComponent(result.errors.slice(0, 8).join(" | "));
    return NextResponse.redirect(new URL(`/data-upload?imported=${result.imported}&error=${message}`, request.url), 303);
  }

  return NextResponse.redirect(new URL(`/data-upload?imported=${result.imported}`, request.url), 303);
}
