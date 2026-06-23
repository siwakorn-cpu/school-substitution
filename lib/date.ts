export const thaiDays = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

export function dayOfWeekFromDate(date: Date) {
  return date.getDay();
}

export function formatThaiDate(date: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium"
  }).format(date);
}

export function parseDateInput(value: string) {
  return new Date(`${value}T00:00:00`);
}

export function toDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function nextDateForDayOfWeek(fromDate: Date, targetDayOfWeek: number) {
  const date = new Date(fromDate);
  const diff = (targetDayOfWeek - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + diff);
  return date;
}
