import { serverError } from "@/lib/api-error";
﻿import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      const message = result.error.issues[0]?.message || "Datos inválidos";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { email, password } = result.data;
    const rateKey = `${ip}:${email}`;
    if (!checkRateLimit(rateKey, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Demasiados intentos de acceso. Intente en 15 minutos." },
        { status: 429 }
      );
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    await createSession(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err: unknown) {
    return serverError(err);
  }
}
