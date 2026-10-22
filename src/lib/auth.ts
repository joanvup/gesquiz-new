import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const tokenBytes = crypto.randomBytes(32);
  const token = tokenBytes.toString("hex");
  const tokenHash = hashToken(token);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

  await db.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set({
    name: "session",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function getSessionUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (!token) return null;

    const tokenHash = hashToken(token);
    const session = await db.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return null;
    }

    return session.user;
  } catch {
    return null;
  }
}

export async function destroySession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (token) {
      const tokenHash = hashToken(token);
      await db.session.deleteMany({ where: { tokenHash } });
    }
    cookieStore.set({
      name: "session",
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  } catch {}
}

export async function requireUser(allowedRoles?: string[]) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("No autenticado");
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new Error("No autorizado");
  }
  return user;
}
