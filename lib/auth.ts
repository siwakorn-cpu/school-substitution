import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "school_sub_session";

export type SessionUser = {
  id: string;
  username: string;
  role: "ADMIN" | "PERSONNEL" | "HEAD" | "DEPT_REP" | "TEACHER";
  teacherId: string | null;
};

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function createSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME)?.value;
  const userId = session ? verifySession(session) : null;

  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId, isActive: true },
    select: {
      id: true,
      username: true,
      role: true,
      teacherId: true
    }
  });

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

export function canManageAll(role: SessionUser["role"]) {
  return role === "ADMIN";
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || (process.env.NODE_ENV === "production" && secret.length < 32)) {
    throw new Error("SESSION_SECRET must be set and contain at least 32 characters in production");
  }
  return secret;
}

function sessionSignature(userId: string) {
  return createHmac("sha256", getSessionSecret()).update(userId).digest("base64url");
}

function signSession(userId: string) {
  return `${userId}.${sessionSignature(userId)}`;
}

function verifySession(value: string) {
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;

  const userId = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = sessionSignature(userId);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) return null;
  return timingSafeEqual(actualBuffer, expectedBuffer) ? userId : null;
}
