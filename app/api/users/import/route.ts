import { requireAdmin } from "@/lib/auth";
import { importUsers, parseUserFile } from "@/lib/importUsers";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: Request) {
  await requireAdmin();
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return redirectTo(request, "/users?error=ไม่พบไฟล์ผู้ใช้");
  }

  let rows;
  try {
    rows = await parseUserFile(file);
  } catch {
    return redirectTo(request, "/users?error=ไฟล์ผู้ใช้ไม่ถูกต้องหรือไม่รองรับ");
  }
  const result = await importUsers(rows);

  if (result.errors.length > 0) {
    const message = encodeURIComponent(result.errors.slice(0, 8).join(" | "));
    return redirectTo(request, `/users?imported=${result.imported}&error=${message}`);
  }

  return redirectTo(request, `/users?imported=${result.imported}`);
}
