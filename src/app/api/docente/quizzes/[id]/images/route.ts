import { serverError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTeacherQuiz } from "@/lib/quiz-access";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getMaxImageBytes,
  saveQuizImage,
  uploadPublicUrl,
  UploadError,
} from "@/lib/uploads";

/** Lista las imagenes registradas del quiz. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quizId } = await params;
    const access = await getTeacherQuiz(quizId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const images = await db.quizImage.findMany({
      where: { quizId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      images: images.map((image) => ({
        id: image.id,
        fileName: image.fileName,
        mimeType: image.mimeType,
        size: image.size,
        url: uploadPublicUrl(image.storedPath),
        createdAt: image.createdAt,
      })),
    });
  } catch (err) {
    return serverError(err);
  }
}

/** Sube una imagen para usarla en el enunciado u opciones de una pregunta. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quizId } = await params;
    const access = await getTeacherQuiz(quizId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    if (!checkRateLimit(`upload:${access.user.id}`, 60, 60 * 1000)) {
      return NextResponse.json(
        { error: "Demasiadas subidas seguidas. Espera un momento." },
        { status: 429 }
      );
    }

    const maxBytes = getMaxImageBytes();
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > maxBytes + 1024 * 1024) {
      return NextResponse.json(
        { error: `La imagen supera el límite de ${Math.floor(maxBytes / (1024 * 1024))} MB.` },
        { status: 413 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No se recibió ninguna imagen" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const stored = await saveQuizImage({
      quizId,
      fileName: file.name,
      buffer,
    });

    const image = await db.quizImage.create({
      data: {
        quizId,
        fileName: stored.fileName,
        storedPath: stored.storedPath,
        mimeType: stored.mimeType,
        size: stored.size,
      },
    });

    return NextResponse.json({
      success: true,
      image: {
        id: image.id,
        fileName: image.fileName,
        mimeType: image.mimeType,
        size: image.size,
        url: stored.url,
      },
    });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return serverError(err);
  }
}
