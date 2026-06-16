import { requireAdmin } from "@/lib/auth";
import { importSchedules, parseScheduleFile } from "@/lib/importSchedules";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: Request) {
  await requireAdmin();
  const formData = await request.formData();
  const file = formData.get("file");
  const term = String(formData.get("term") ?? "1/2569").trim();

  if (!(file instanceof File)) {
    return redirectTo(request, "/data-upload?error=ไม่พบไฟล์");
  }

  let rows;
  try {
    rows = await parseScheduleFile(file);
  } catch {
    return redirectTo(request, "/data-upload?error=ไฟล์ไม่ถูกต้องหรือไม่รองรับ");
  }
  const result = await importSchedules(rows, term);

  if (result.errors.length > 0) {
    const message = encodeURIComponent(result.errors.slice(0, 8).join(" | "));
    return redirectTo(request, `/data-upload?imported=${result.imported}&error=${message}`);
  }

  return redirectTo(request, `/data-upload?imported=${result.imported}`);
}
