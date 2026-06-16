import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { importUsers, parseUserFile } from "@/lib/importUsers";

export async function POST(request: Request) {
  await requireAdmin();
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.redirect(new URL("/users?error=ไม่พบไฟล์ผู้ใช้", request.url), 303);
  }

  let rows;
  try {
    rows = await parseUserFile(file);
  } catch {
    return NextResponse.redirect(new URL("/users?error=ไฟล์ผู้ใช้ไม่ถูกต้องหรือไม่รองรับ", request.url), 303);
  }
  const result = await importUsers(rows);

  if (result.errors.length > 0) {
    const message = encodeURIComponent(result.errors.slice(0, 8).join(" | "));
    return NextResponse.redirect(new URL(`/users?imported=${result.imported}&error=${message}`, request.url), 303);
  }

  return NextResponse.redirect(new URL(`/users?imported=${result.imported}`, request.url), 303);
}
