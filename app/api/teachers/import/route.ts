import { requireUser } from "@/lib/auth";
import { importTeachers, parseTeacherFile } from "@/lib/importTeachers";
import { canManageTeacher } from "@/lib/rbac";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!(await canManageTeacher(user))) return redirectTo(request, "/dashboard");
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return redirectTo(request, "/data-upload/teachers?teacherError=ไม่พบไฟล์รายชื่อครู");
  }

  let rows;
  try {
    rows = await parseTeacherFile(file);
  } catch {
    return redirectTo(request, "/data-upload/teachers?teacherError=ไฟล์รายชื่อครูไม่ถูกต้องหรือไม่รองรับ");
  }
  const result = await importTeachers(rows);

  if (result.errors.length > 0) {
    const message = encodeURIComponent(result.errors.slice(0, 8).join(" | "));
    return redirectTo(request, `/data-upload/teachers?teacherImported=${result.imported}&teacherError=${message}`);
  }

  return redirectTo(request, `/data-upload/teachers?teacherImported=${result.imported}`);
}
