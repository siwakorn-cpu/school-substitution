import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";

function redirectBack(request: NextRequest, formData: FormData, key: "scheduleMessage" | "scheduleError", message: string) {
  const params = new URLSearchParams({
    scheduleTeacherId: String(formData.get("scheduleTeacherId") ?? formData.get("teacherId") ?? ""),
    scheduleTerm: String(formData.get("scheduleTerm") ?? formData.get("term") ?? "1/2569")
  });
  params.set(key, message);
  return redirectTo(request, `/data-upload?${params.toString()}`);
}

function readScheduleForm(formData: FormData) {
  const teacherId = String(formData.get("teacherId") ?? "").trim();
  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const period = Number(formData.get("period"));
  const classRoomId = String(formData.get("classRoomId") ?? "").trim();
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  const specialRoomId = String(formData.get("specialRoomId") ?? "").trim() || null;
  const term = String(formData.get("term") ?? "").trim();

  return { teacherId, dayOfWeek, period, classRoomId, subjectId, specialRoomId, term };
}

async function validateSchedule(data: ReturnType<typeof readScheduleForm>, currentId?: string) {
  if (
    !data.teacherId ||
    !data.classRoomId ||
    !data.subjectId ||
    !data.term ||
    !Number.isInteger(data.dayOfWeek) ||
    data.dayOfWeek < 0 ||
    data.dayOfWeek > 6 ||
    !Number.isInteger(data.period) ||
    data.period < 1 ||
    data.period > 10
  ) {
    return "กรุณากรอกข้อมูลตารางสอนให้ครบถ้วน";
  }

  const excludeCurrent = currentId ? { id: { not: currentId } } : {};
  const [teacherConflict, classRoomConflict, specialRoomConflict] = await Promise.all([
    prisma.teachingSchedule.findFirst({
      where: {
        ...excludeCurrent,
        teacherId: data.teacherId,
        dayOfWeek: data.dayOfWeek,
        period: data.period,
        term: data.term
      }
    }),
    prisma.teachingSchedule.findFirst({
      where: {
        ...excludeCurrent,
        classRoomId: data.classRoomId,
        dayOfWeek: data.dayOfWeek,
        period: data.period,
        term: data.term
      }
    }),
    data.specialRoomId
      ? prisma.teachingSchedule.findFirst({
          where: {
            ...excludeCurrent,
            specialRoomId: data.specialRoomId,
            dayOfWeek: data.dayOfWeek,
            period: data.period,
            term: data.term
          }
        })
      : Promise.resolve(null)
  ]);

  if (teacherConflict) return "ครูคนนี้มีตารางสอนในคาบดังกล่าวแล้ว";
  if (classRoomConflict) return "ห้องเรียนนี้มีตารางสอนในคาบดังกล่าวแล้ว";
  if (specialRoomConflict) return "ห้องพิเศษนี้มีตารางสอนในคาบดังกล่าวแล้ว";

  return null;
}

export async function POST(request: NextRequest) {
  await requireAdmin();
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "");
    if (!id) return redirectBack(request, formData, "scheduleError", "ไม่พบรายการตารางสอนที่ต้องการลบ");

    try {
      await prisma.teachingSchedule.delete({ where: { id } });
      return redirectBack(request, formData, "scheduleMessage", "ลบคาบสอนเรียบร้อยแล้ว");
    } catch {
      return redirectBack(
        request,
        formData,
        "scheduleError",
        "ลบคาบสอนไม่ได้ เพราะมีรายการลา/สอนแทน/แลกคาบที่อ้างอิงคาบนี้อยู่"
      );
    }
  }

  const data = readScheduleForm(formData);
  const id = String(formData.get("id") ?? "");
  const error = await validateSchedule(data, intent === "update" ? id : undefined);
  if (error) return redirectBack(request, formData, "scheduleError", error);

  if (intent === "create") {
    await prisma.teachingSchedule.create({ data });
    return redirectBack(request, formData, "scheduleMessage", "เพิ่มคาบสอนเรียบร้อยแล้ว");
  }

  if (intent === "update") {
    if (!id) return redirectBack(request, formData, "scheduleError", "ไม่พบรายการตารางสอนที่ต้องการแก้ไข");
    await prisma.teachingSchedule.update({ where: { id }, data });
    return redirectBack(request, formData, "scheduleMessage", "บันทึกการแก้ไขตารางสอนเรียบร้อยแล้ว");
  }

  return redirectBack(request, formData, "scheduleError", "คำสั่งไม่ถูกต้อง");
}
