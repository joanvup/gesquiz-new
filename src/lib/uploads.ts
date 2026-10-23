import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Almacenamiento local de imagenes de preguntas.
 *
 * Los archivos se guardan FUERA de `public/` (por defecto `storage/uploads`)
 * para que sigan disponibles despues de compilar (`next build`/`next start`) y
 * se sirven a traves de `/api/uploads/[...path]`. En produccion se puede
 * apuntar `UPLOAD_DIR` a un volumen persistente o a un disco montado.
 */

export const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const DEFAULT_MAX_IMAGE_MB = 5;
const STORED_PATH_PATTERN = /^[A-Za-z0-9._/-]+$/;

export function getUploadRoot(): string {
  const configured = process.env.UPLOAD_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), "storage", "uploads");
}

export function getMaxImageBytes(): number {
  const parsed = Number.parseFloat(process.env.MAX_IMAGE_MB ?? "");
  const mb = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_IMAGE_MB;
  return Math.floor(mb * 1024 * 1024);
}

/** URL publica same-origin para un archivo almacenado. */
export function uploadPublicUrl(storedPath: string): string {
  return `/api/uploads/${storedPath.replace(/\\/g, "/")}`;
}

/**
 * Resuelve una ruta relativa guardada en BD a una ruta absoluta dentro de
 * `UPLOAD_DIR`, rechazando cualquier intento de salir del directorio.
 */
export function resolveStoredFile(storedPath: string): string | null {
  const normalized = storedPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) return null;
  if (!STORED_PATH_PATTERN.test(normalized)) return null;

  const root = getUploadRoot();
  const absolute = path.resolve(root, ...normalized.split("/"));
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (!absolute.startsWith(rootWithSep)) return null;

  return absolute;
}

/** Detecta el tipo real de imagen por sus bytes iniciales (anti-spoofing). */
export function detectImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 6 && buffer.subarray(0, 3).toString("ascii") === "GIF") {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export interface StoredImage {
  fileName: string;
  storedPath: string;
  url: string;
  mimeType: string;
  size: number;
}

/**
 * Valida y guarda una imagen de un quiz. Devuelve la ruta relativa y la URL
 * publica lista para insertar en el HTML de una pregunta.
 */
export async function saveQuizImage(params: {
  quizId: string;
  fileName: string;
  buffer: Buffer;
}): Promise<StoredImage> {
  const { quizId, buffer } = params;
  const maxBytes = getMaxImageBytes();

  if (!buffer.length) {
    throw new UploadError("El archivo está vacío.");
  }
  if (buffer.length > maxBytes) {
    throw new UploadError(
      `La imagen supera el límite de ${Math.floor(maxBytes / (1024 * 1024))} MB.`
    );
  }

  const mimeType = detectImageMime(buffer);
  if (!mimeType || !IMAGE_MIME_EXTENSIONS[mimeType]) {
    throw new UploadError("Formato no permitido. Usa PNG, JPG, WEBP o GIF.");
  }

  const extension = IMAGE_MIME_EXTENSIONS[mimeType];
  const safeQuizId = quizId.replace(/[^A-Za-z0-9_-]/g, "");
  const storedPath = `quizzes/${safeQuizId}/${crypto.randomUUID()}.${extension}`;
  const absolute = resolveStoredFile(storedPath);
  if (!absolute) {
    throw new UploadError("Ruta de almacenamiento inválida.");
  }

  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, buffer, { flag: "wx" });

  return {
    fileName: params.fileName.slice(0, 255) || `imagen.${extension}`,
    storedPath,
    url: uploadPublicUrl(storedPath),
    mimeType,
    size: buffer.length,
  };
}

/** Borra un archivo del disco. Ignora errores si ya no existe. */
export async function deleteStoredFile(storedPath: string): Promise<void> {
  const absolute = resolveStoredFile(storedPath);
  if (!absolute) return;
  try {
    await fs.unlink(absolute);
  } catch {
    // Archivo ya eliminado o sin permisos: no bloquea la operacion.
  }
}

/** Borra el directorio de imagenes de un quiz completo. */
export async function deleteQuizImageFolder(quizId: string): Promise<void> {
  const safeQuizId = quizId.replace(/[^A-Za-z0-9_-]/g, "");
  const directory = path.join(getUploadRoot(), "quizzes", safeQuizId);
  try {
    await fs.rm(directory, { recursive: true, force: true });
  } catch {
    // Sin permisos o directorio inexistente.
  }
}

export class UploadError extends Error {}
