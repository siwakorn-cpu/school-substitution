import type { Prisma } from "@prisma/client";

export type ReportRange = "day" | "month" | "term";

export type ReportFilterInput = {
  range?: string;
  date?: string;
  month?: string;
  term?: string;
};

export function buildSubstitutionReportWhere(input: ReportFilterInput) {
  const range = normalizeRange(input.range);
  const where: Prisma.SubstitutionWhereInput = {};
  const labelParts: string[] = [];

  if (range === "day") {
    const date = parseDateInput(input.date);
    if (date) {
      where.date = {
        gte: date,
        lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      };
      labelParts.push(`วันที่ ${formatThaiDate(date)}`);
    }
  }

  if (range === "month") {
    const month = parseMonthInput(input.month);
    if (month) {
      where.date = {
        gte: month,
        lt: new Date(month.getFullYear(), month.getMonth() + 1, 1)
      };
      labelParts.push(
        `เดือน ${new Intl.DateTimeFormat("th-TH", {
          month: "long",
          year: "numeric"
        }).format(month)}`
      );
    }
  }

  if (range === "term" && input.term?.trim()) {
    where.absencePeriod = {
      schedule: {
        term: input.term.trim()
      }
    };
    labelParts.push(`ภาคเรียน ${input.term.trim()}`);
  }

  return {
    range,
    where,
    label: labelParts.join(" · ") || "ข้อมูลทั้งหมด"
  };
}

export function normalizeRange(value?: string): ReportRange {
  if (value === "day" || value === "month" || value === "term") return value;
  return "month";
}

export function parseDateInput(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseMonthInput(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function currentMonthInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function formatThaiDate(date: Date) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(date);
}
