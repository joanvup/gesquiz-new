import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";

export async function POST(request: Request) {
  try {
    const isValidCsrf = await verifyCsrf(request);
    if (!isValidCsrf) {
      return NextResponse.json({ error: "Token CSRF inválido" }, { status: 403 });
    }

    await destroySession();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
