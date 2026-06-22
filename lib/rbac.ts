import type { SessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export function canApproveSwap(user: SessionUser) {
  return hasPermission(user, "approve_schedule_changes");
}

export function canManageSwap(user: SessionUser) {
  return hasPermission(user, "manage_swaps");
}

export function canManageAbsence(user: SessionUser) {
  return hasPermission(user, "manage_all_absences");
}

export function canRecordOwnAbsence(user: SessionUser) {
  return hasPermission(user, "record_own_absence");
}

export function canManageSubstitution(user: SessionUser) {
  return hasPermission(user, "manage_substitutions");
}

export function canViewReports(user: SessionUser) {
  return hasPermission(user, "view_reports");
}

export function canManageTeacher(user: SessionUser) {
  return hasPermission(user, "manage_teacher_data");
}

export function canImportSchedule(user: SessionUser) {
  return hasPermission(user, "import_schedules");
}
