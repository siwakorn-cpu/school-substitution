import { prisma } from "@/lib/prisma";

const FALLBACK_TERM = "1/2569";

export async function getTermOptions() {
  const [storedTerms, scheduleTerms] = await Promise.all([
    prisma.schoolTerm.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
      select: { name: true, isCurrent: true }
    }),
    prisma.teachingSchedule.findMany({
      distinct: ["term"],
      orderBy: { term: "desc" },
      select: { term: true }
    })
  ]);

  const names = new Set<string>();
  for (const term of storedTerms) names.add(term.name);
  for (const term of scheduleTerms) names.add(term.term);
  names.add(FALLBACK_TERM);

  const currentTerm = storedTerms.find((term) => term.isCurrent)?.name ?? scheduleTerms[0]?.term ?? FALLBACK_TERM;

  return {
    currentTerm,
    terms: Array.from(names)
  };
}
