import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveStoredFile } from "@/lib/uploads";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Sirve las imagenes guardadas en `UPLOAD_DIR` (por defecto `storage/uploads`).
 * Se usa una ruta propia en lugar de `public/` para que los archivos subidos
 * en produccion sigan disponibles despues de `next build`.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  if (!segments?.length) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const storedPath = segments.join("/");
  const absolute = resolveStoredFile(storedPath);
  if (!absolute) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  try {
    const file = await fs.readFile(absolute);
    const extension = path.extname(absolute).toLowerCase();
    const contentType = MIME_BY_EXTENSION[extension] ?? "application/octet-stream";

    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(file.length),
        // El nombre del archivo incluye un UUID: su contenido es inmutable.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("No encontrado", { status: 404 });
  }
}
