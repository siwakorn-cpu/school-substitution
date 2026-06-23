import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";

const REDIRECT = "/settings/subjects";

export async function POST(request: Request) {
  await requireAdmin();
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "create");

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "");
    if (id) await prisma.activityPeriod.deleteMany({ where: { id } });
    return redirectTo(request, REDIRECT);
  }

  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const period = Number(formData.get("period"));
  const type = String(formData.get("type") ?? "");

  if (
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 1 ||
    dayOfWeek > 5 ||
    !Number.isInteger(period) ||
    period < 1 ||
    period > 10 ||
    (type !== "CLUB" && type !== "SCOUT")
  ) {
    return redirectTo(request, REDIRECT);
  }

  // One activity type per (day, period); re-adding the same slot updates its type.
  await prisma.activityPeriod.upsert({
    where: { dayOfWeek_period: { dayOfWeek, period } },
    create: { dayOfWeek, period, type },
    update: { type }
  });

  return redirectTo(request, REDIRECT);
}
