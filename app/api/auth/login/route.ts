import { createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive) {
    return redirectTo(request, "/login?error=1");
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return redirectTo(request, "/login?error=1");
  }

  await createSession(user.id);
  return redirectTo(request, "/dashboard");
}
