import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  await requireAdmin();
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (intent === "create" && name) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  if (intent === "update" && name) {
    await prisma.department.update({
      where: { id: String(formData.get("id") ?? "") },
      data: { name }
    });
  }

  return NextResponse.redirect(new URL("/data-upload", request.url), 303);
}
