import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: Request) {
  await requireAdmin();
  const formData = await request.formData();
  const subjectIds = formData.getAll("subjectIds").map(String).filter(Boolean);
  const enabledIds = new Set(formData.getAll("requiresSubstitution").map(String));

  await prisma.$transaction(
    subjectIds.map((id) =>
      prisma.subject.update({
        where: { id },
        data: { requiresSubstitution: enabledIds.has(id) }
      })
    )
  );

  return redirectTo(request, "/settings/subjects");
}
