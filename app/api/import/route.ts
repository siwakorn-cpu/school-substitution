import { requireUser } from "@/lib/auth";
import { importSchedules, parseScheduleFile } from "@/lib/importSchedules";
import { canImportSchedule } from "@/lib/rbac";
import { redirectTo } from "@/lib/redirect";
import { logActivity } from "@/lib/auditLog";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!(await canImportSchedule(user))) return redirectTo(request, "/dashboard");
  const formData = await request.formData();
  const file = formData.get("file");
  const term = String(formData.get("term") ?? "1/2569").trim();

  if (!(file instanceof File)) {
    return redirectTo(request, "/data-upload/schedules?error=ไม่พบไฟล์");
  }

  let rows;
  try {
    rows = await parseScheduleFile(file);
  } catch {
    return redirectTo(request, "/data-upload/schedules?error=ไฟล์ไม่ถูกต้องหรือไม่รองรับ");
  }
  const result = await importSchedules(rows, term);
  await logActivity(user, "import", "TeachingSchedule", null, `นำเข้าตารางสอนเทอม ${term} จำนวน ${result.imported} รายการ`);

  if (result.errors.length > 0) {
    const message = encodeURIComponent(result.errors.slice(0, 8).join(" | "));
    return redirectTo(request, `/data-upload/schedules?imported=${result.imported}&error=${message}`);
  }

  return redirectTo(request, `/data-upload/schedules?imported=${result.imported}`);
}
