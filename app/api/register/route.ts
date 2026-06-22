import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const teacherId = String(formData.get("teacherId") ?? "").trim();

  if (!username || password.length < 6 || password !== confirmPassword) {
    return redirectTo(request, "/register?error=password");
  }

  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) {
    return redirectTo(request, "/register?error=username");
  }

  const teacher = teacherId
    ? await prisma.teacher.findFirst({
        where: { id: teacherId, status: "ACTIVE", user: null }
      })
    : null;
  if (!teacher) {
    return redirectTo(request, "/register?error=teacher");
  }

  await prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      role: "TEACHER",
      teacherId,
      isActive: false
    }
  });

  return redirectTo(request, "/login?registered=1");
}
