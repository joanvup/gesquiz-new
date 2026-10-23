import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db } from "@/lib/db";
import { nextQuestionOrder, recalculateQuizScore } from "@/lib/quiz-total";
import { sanitizeQuestionHtml } from "@/lib/sanitize-question";
import { isBlankHtml } from "@/lib/html-text";
import {
  resolveStoredFile,
  saveQuizImage,
  uploadPublicUrl,
} from "@/lib/uploads";

/**
 * Exportacion / importacion de un quiz completo en JSON.
 *
 * El archivo incluye la configuracion del quiz, sus preguntas y las imagenes
 * incrustadas en base64, de modo que se puede mover entre instalaciones
 * (por ejemplo, del entorno local a produccion) sin depender de rutas.
 */

export const QUIZ_TRANSFER_VERSION = 1;
export const MAX_TRANSFER_BYTES = 40 * 1024 * 1024;

const optionSchema = z.object({
  orden: z.number().int().optional(),
  textoHtml: z.string().max(100_000),
  esCorrecta: z.boolean().default(false),
  fraction: z.number().default(0),
  feedbackHtml: z.string().max(50_000).nullish(),
  extraJson: z.string().max(50_000).nullish(),
});

const questionSchema = z.object({
  tipo: z.string().min(1).max(50),
  enunciadoHtml: z.string().max(200_000),
  formato: z.string().max(50).default("html"),
  defaultGrade: z.number().min(0).max(1000).default(1),
  penalty: z.number().min(0).max(100).default(0),
  generalFeedbackHtml: z.string().max(100_000).nullish(),
  category: z.string().max(500).nullish(),
  orden: z.number().int().optional(),
  noPuntua: z.boolean().default(false),
  datosJson: z.string().max(100_000).nullish(),
  options: z.array(optionSchema).max(200).default([]),
});

const imageSchema = z.object({
  fileName: z.string().max(255),
  mimeType: z.string().max(100),
  size: z.number().int().nonnegative().optional(),
  url: z.string().max(1000),
  dataBase64: z.string().max(20_000_000),
});

const quizConfigSchema = z.object({
  titulo: z.string().min(1).max(300),
  descripcion: z.string().max(20_000).nullish(),
  instrucciones: z.string().max(20_000).nullish(),
  permitirRetroceso: z.boolean().default(true),
  advertirAlContinuar: z.boolean().default(false),
  tiempoLimiteMinutos: z.number().int().positive().max(100_000).nullish(),
  ordenAleatorioPreguntas: z.boolean().default(false),
  ordenAleatorioOpciones: z.boolean().default(false),
  intentosPermitidos: z.number().int().min(1).max(100).default(1),
  ventanaAbre: z.string().max(50).nullish(),
  ventanaCierra: z.string().max(50).nullish(),
  mostrarResultado: z
    .enum(["NOTA", "NOTA_Y_RESPUESTAS", "NADA"])
    .default("NOTA"),
  modoSeguro: z.boolean().default(true),
  maxInfracciones: z.number().int().min(1).max(50).default(3),
});

export const quizTransferSchema = z.object({
  version: z.number().int().min(1).max(QUIZ_TRANSFER_VERSION),
  exportedAt: z.string().max(50).optional(),
  quiz: quizConfigSchema,
  questions: z.array(questionSchema).max(1000).default([]),
  images: z.array(imageSchema).max(300).default([]),
});

export type QuizTransferFile = z.infer<typeof quizTransferSchema>;

export interface QuizExportFile extends QuizTransferFile {
  meta: {
    generador: "QuizColegio";
    version: number;
    exportedAt: string;
  };
}

function collectImageUrls(questions: QuizTransferFile["questions"]): Set<string> {
  const urls = new Set<string>();
  const collect = (html?: string | null) => {
    if (!html) return;
    const regex = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      urls.add(match[1]);
    }
  };

  for (const question of questions) {
    collect(question.enunciadoHtml);
    collect(question.generalFeedbackHtml);
    for (const option of question.options) {
      collect(option.textoHtml);
      collect(option.feedbackHtml);
    }
  }

  return urls;
}

function mimeFromExtension(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  switch (extension) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

/**
 * Resuelve una URL de imagen local (nueva API de uploads o carpeta public
 * historica de importaciones Moodle) a su archivo en disco.
 */
function resolveImageUrl(url: string): string | null {
  if (!url.startsWith("/")) return null;

  const withoutQuery = url.split("?")[0];

  if (withoutQuery.startsWith("/api/uploads/")) {
    const storedPath = decodeURIComponent(withoutQuery.slice("/api/uploads/".length));
    return resolveStoredFile(storedPath);
  }

  if (withoutQuery.startsWith("/uploads/")) {
    const relative = decodeURIComponent(withoutQuery.slice("/".length));
    const absolute = path.resolve(process.cwd(), "public", ...relative.split("/"));
    const publicRoot = path.resolve(process.cwd(), "public");
    if (!absolute.startsWith(publicRoot + path.sep)) return null;
    return absolute;
  }

  return null;
}

/** Construye el archivo JSON de exportacion de un quiz. */
export async function buildQuizExport(quizId: string): Promise<QuizExportFile> {
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        include: { options: { orderBy: { orden: "asc" } } },
        orderBy: { orden: "asc" },
      },
      images: true,
    },
  });

  if (!quiz) throw new Error("Quiz no encontrado");

  const transfer: QuizTransferFile = {
    version: QUIZ_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    quiz: {
      titulo: quiz.titulo,
      descripcion: quiz.descripcion,
      instrucciones: quiz.instrucciones,
      permitirRetroceso: quiz.permitirRetroceso,
      advertirAlContinuar: quiz.advertirAlContinuar,
      tiempoLimiteMinutos: quiz.tiempoLimiteMinutos,
      ordenAleatorioPreguntas: quiz.ordenAleatorioPreguntas,
      ordenAleatorioOpciones: quiz.ordenAleatorioOpciones,
      intentosPermitidos: quiz.intentosPermitidos,
      ventanaAbre: quiz.ventanaAbre?.toISOString() ?? null,
      ventanaCierra: quiz.ventanaCierra?.toISOString() ?? null,
      mostrarResultado: quiz.mostrarResultado as QuizTransferFile["quiz"]["mostrarResultado"],
      modoSeguro: quiz.modoSeguro,
      maxInfracciones: quiz.maxInfracciones,
    },
    questions: quiz.questions.map((question) => ({
      tipo: question.tipo,
      enunciadoHtml: question.enunciadoHtml,
      formato: question.formato,
      defaultGrade: question.defaultGrade,
      penalty: question.penalty,
      generalFeedbackHtml: question.generalFeedbackHtml,
      category: question.category,
      orden: question.orden,
      noPuntua: question.noPuntua,
      datosJson: question.datosJson,
      options: question.options.map((option) => ({
        orden: option.orden,
        textoHtml: option.textoHtml,
        esCorrecta: option.esCorrecta,
        fraction: option.fraction,
        feedbackHtml: option.feedbackHtml,
        extraJson: option.extraJson,
      })),
    })),
    images: [],
  };

  // Imagenes registradas + imagenes referenciadas en el HTML (incluye las
  // importadas desde Moodle antes de existir la tabla QuizImage).
  const candidates = new Map<string, { fileName: string; storedPath: string | null }>();

  for (const image of quiz.images) {
    candidates.set(uploadPublicUrl(image.storedPath), {
      fileName: image.fileName,
      storedPath: image.storedPath,
    });
  }

  for (const url of collectImageUrls(transfer.questions)) {
    if (candidates.has(url)) continue;
    const absolute = resolveImageUrl(url);
    if (!absolute) continue;
    candidates.set(url, {
      fileName: path.basename(absolute),
      storedPath: null,
    });
  }

  for (const [url, meta] of candidates) {
    const absolute = meta.storedPath
      ? resolveStoredFile(meta.storedPath)
      : resolveImageUrl(url);
    if (!absolute) continue;

    try {
      const buffer = await fs.readFile(absolute);
      transfer.images.push({
        fileName: meta.fileName,
        mimeType: mimeFromExtension(meta.fileName || absolute),
        size: buffer.length,
        url,
        dataBase64: buffer.toString("base64"),
      });
    } catch {
      // Imagen perdida en disco: se omite del paquete.
    }
  }

  return {
    ...transfer,
    meta: {
      generador: "QuizColegio",
      version: QUIZ_TRANSFER_VERSION,
      exportedAt: transfer.exportedAt ?? new Date().toISOString(),
    },
  };
}

export interface QuizImportOptions {
  teacherId: string;
  targetQuizId?: string;
  applyQuizConfig: boolean;
  replaceQuestions: boolean;
}

export interface QuizImportReport {
  quizId: string;
  creadas: number;
  omitidas: number;
  imagenesImportadas: number;
  advertencias: string[];
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Importa el paquete JSON en un quiz existente o crea uno nuevo. */
export async function importQuizTransfer(
  raw: unknown,
  options: QuizImportOptions
): Promise<QuizImportReport> {
  const parsed = quizTransferSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const pathLabel = issue?.path.join(".") || "archivo";
    throw new Error(`Formato inválido en "${pathLabel}": ${issue?.message ?? "datos incorrectos"}`);
  }

  const data = parsed.data;
  const advertencias: string[] = [];
  let quizId = options.targetQuizId;

  if (quizId) {
    const existing = await db.quiz.findUnique({
      where: { id: quizId },
      include: { _count: { select: { attempts: true } } },
    });
    if (!existing) throw new Error("Quiz no encontrado");

    if (options.replaceQuestions) {
      if (existing._count.attempts > 0) {
        throw new Error(
          "No se pueden reemplazar las preguntas de un quiz con intentos registrados."
        );
      }
      await db.question.deleteMany({ where: { quizId } });
    }
  } else {
    const created = await db.quiz.create({
      data: {
        teacherId: options.teacherId,
        titulo: data.quiz.titulo,
        descripcion: data.quiz.descripcion || null,
        instrucciones: data.quiz.instrucciones || null,
        permitirRetroceso: data.quiz.permitirRetroceso,
        advertirAlContinuar: data.quiz.advertirAlContinuar,
        tiempoLimiteMinutos: data.quiz.tiempoLimiteMinutos || null,
        ordenAleatorioPreguntas: data.quiz.ordenAleatorioPreguntas,
        ordenAleatorioOpciones: data.quiz.ordenAleatorioOpciones,
        intentosPermitidos: data.quiz.intentosPermitidos,
        ventanaAbre: parseDate(data.quiz.ventanaAbre),
        ventanaCierra: parseDate(data.quiz.ventanaCierra),
        mostrarResultado: data.quiz.mostrarResultado,
        modoSeguro: data.quiz.modoSeguro,
        maxInfracciones: data.quiz.maxInfracciones,
        // Un quiz importado nunca se publica automaticamente.
        publicado: false,
      },
    });
    quizId = created.id;
  }

  if (!quizId) throw new Error("No se pudo determinar el quiz destino");

  // 1. Imagenes: se guardan con nombres nuevos y se mapean las URLs antiguas.
  const urlMap = new Map<string, string>();
  let imagenesImportadas = 0;

  for (const image of data.images) {
    if (!image.dataBase64) continue;
    try {
      const buffer = Buffer.from(image.dataBase64, "base64");
      const stored = await saveQuizImage({
        quizId,
        fileName: image.fileName,
        buffer,
      });
      await db.quizImage.create({
        data: {
          quizId,
          fileName: stored.fileName,
          storedPath: stored.storedPath,
          mimeType: stored.mimeType,
          size: stored.size,
        },
      });
      urlMap.set(image.url, stored.url);
      imagenesImportadas++;
    } catch (error) {
      advertencias.push(
        `No se pudo importar la imagen "${image.fileName}": ${
          error instanceof Error ? error.message : "error desconocido"
        }`
      );
    }
  }

  const replaceUrls = (value: string | null | undefined): string | null => {
    if (!value) return value ?? null;
    let result = value;
    for (const [oldUrl, newUrl] of urlMap) {
      result = result.split(oldUrl).join(newUrl);
    }
    return result;
  };

  // 2. Configuracion del quiz (opcional al fusionar con uno existente).
  if (options.targetQuizId && options.applyQuizConfig) {
    await db.quiz.update({
      where: { id: quizId },
      data: {
        titulo: data.quiz.titulo,
        descripcion: data.quiz.descripcion || null,
        instrucciones: data.quiz.instrucciones || null,
        permitirRetroceso: data.quiz.permitirRetroceso,
        advertirAlContinuar: data.quiz.advertirAlContinuar,
        tiempoLimiteMinutos: data.quiz.tiempoLimiteMinutos || null,
        ordenAleatorioPreguntas: data.quiz.ordenAleatorioPreguntas,
        ordenAleatorioOpciones: data.quiz.ordenAleatorioOpciones,
        intentosPermitidos: data.quiz.intentosPermitidos,
        ventanaAbre: parseDate(data.quiz.ventanaAbre),
        ventanaCierra: parseDate(data.quiz.ventanaCierra),
        mostrarResultado: data.quiz.mostrarResultado,
        modoSeguro: data.quiz.modoSeguro,
        maxInfracciones: data.quiz.maxInfracciones,
      },
    });
  }

  // 3. Preguntas: se agregan al final cuando el modo es fusionar.
  const startOrder = options.replaceQuestions ? 1 : await nextQuestionOrder(quizId);
  let creadas = 0;
  let omitidas = 0;
  let orden = startOrder;

  for (const [index, question] of data.questions.entries()) {
    try {
      const tipo = question.tipo.toUpperCase();
      const enunciadoHtml = sanitizeQuestionHtml(
        replaceUrls(question.enunciadoHtml)
      );

      if (!enunciadoHtml) {
        omitidas++;
        advertencias.push(`Pregunta #${index + 1}: enunciado vacío, se omitió.`);
        continue;
      }

      const construirOpcion = (option: (typeof question.options)[number], position: number) => {
        const textoHtml =
          tipo === "SHORTANSWER"
            ? replaceUrls(option.textoHtml)?.trim() ?? ""
            : sanitizeQuestionHtml(replaceUrls(option.textoHtml));
        const feedbackHtml = sanitizeQuestionHtml(replaceUrls(option.feedbackHtml));

        return {
          orden: position + 1,
          textoHtml,
          esCorrecta: option.esCorrecta,
          fraction: option.fraction,
          feedbackHtml: isBlankHtml(feedbackHtml) ? null : feedbackHtml,
          extraJson: replaceUrls(option.extraJson),
        };
      };

      const generalFeedbackHtml = sanitizeQuestionHtml(
        replaceUrls(question.generalFeedbackHtml)
      );

      await db.question.create({
        data: {
          quizId,
          tipo,
          enunciadoHtml,
          formato: question.formato || "html",
          defaultGrade: question.defaultGrade,
          penalty: question.penalty,
          generalFeedbackHtml:
            isBlankHtml(generalFeedbackHtml) ? null : generalFeedbackHtml,
          category: question.category || null,
          orden,
          noPuntua: question.noPuntua,
          datosJson: replaceUrls(question.datosJson),
          options: {
            create: question.options.map(construirOpcion),
          },
        },
      });

      creadas++;
      orden++;
    } catch (error) {
      omitidas++;
      advertencias.push(
        `Pregunta #${index + 1}: ${
          error instanceof Error ? error.message : "error desconocido"
        }`
      );
    }
  }

  const puntajeMaximo = await recalculateQuizScore(quizId);

  if (advertencias.length === 0 && puntajeMaximo === 0 && creadas > 0) {
    advertencias.push("El quiz quedó con puntaje 0: revisa los puntajes de las preguntas.");
  }

  return {
    quizId,
    creadas,
    omitidas,
    imagenesImportadas,
    advertencias,
  };
}
