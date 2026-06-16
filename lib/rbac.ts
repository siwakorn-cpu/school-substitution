import type { SessionUser } from "@/lib/auth";

export function canApproveSwap(user: SessionUser) {
  return user.role === "ADMIN" || user.role === "HEAD" || user.role === "DEPT_REP";
}

export function canManageSwap(user: SessionUser) {
  return user.role === "ADMIN" || user.role === "HEAD" || user.role === "DEPT_REP" || Boolean(user.teacherId);
}

export function canManageAbsence(user: SessionUser) {
  return user.role === "ADMIN" || user.role === "PERSONNEL";
}

export function canRecordOwnAbsence(user: SessionUser) {
  return Boolean(user.teacherId);
}

export function canManageTeacher(user: SessionUser) {
  return user.role === "ADMIN";
}

export function canImportSchedule(user: SessionUser) {
  return user.role === "ADMIN";
}
