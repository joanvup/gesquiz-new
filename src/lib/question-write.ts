import { z } from "zod";
import {
  MANUAL_QUESTION_TYPES,
  type ManualQuestionType,
} from "@/lib/question-types";
import { isBlankHtml, sanitizeQuestionHtml } from "@/lib/sanitize-question";

const MAX_OPTIONS = 30;

export const optionInputSchema = z.object({
  textoHtml: z.string().max(20_000, "La opción es demasiado larga"),
  esCorrecta: z.boolean().default(false),
});

export const manualQuestionInputSchema = z
  .object({
    tipo: z.enum(MANUAL_QUESTION_TYPES),
    enunciadoHtml: z.string().max(100_000, "El enunciado es demasiado largo"),
    defaultGrade: z
      .number()
      .positive("El puntaje debe ser mayor que 0")
      .max(1000, "El puntaje máximo es 1000"),
    generalFeedbackHtml: z.string().max(50_000).nullish(),
    opciones: z.array(optionInputSchema).max(MAX_OPTIONS).default([]),
    respuestaVerdadero: z.boolean().optional(),
    respuestasAceptadas: z.array(z.string().max(500)).max(50).default([]),
    distinguirMayusculas: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (isBlankHtml(value.enunciadoHtml)) {
      ctx.addIssue({
        code: "custom",
        path: ["enunciadoHtml"],
        message: "El enunciado no puede estar vacío",
      });
    }

    if (
      value.tipo === "MULTICHOICE_SINGLE" ||
      value.tipo === "MULTICHOICE_MULTIPLE"
    ) {
      if (value.opciones.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["opciones"],
          message: "Agrega al menos dos opciones",
        });
        return;
      }

      const correctas = value.opciones.filter((option) => option.esCorrecta);
      if (correctas.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["opciones"],
          message: "Marca al menos una opción como correcta",
        });
      }
      if (value.tipo === "MULTICHOICE_SINGLE" && correctas.length > 1) {
        ctx.addIssue({
          code: "custom",
          path: ["opciones"],
          message: "En respuesta única solo puede haber una opción correcta",
        });
      }

      value.opciones.forEach((option, index) => {
        if (isBlankHtml(option.textoHtml)) {
          ctx.addIssue({
            code: "custom",
            path: ["opciones", index, "textoHtml"],
            message: "La opción no puede estar vacía",
          });
        }
      });
    }

    if (value.tipo === "SHORTANSWER") {
      const respuestas = value.respuestasAceptadas
        .map((answer) => answer.trim())
        .filter(Boolean);

      if (respuestas.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["respuestasAceptadas"],
          message: "Agrega al menos una respuesta aceptada",
        });
      }

      respuestas.forEach((answer, index) => {
        if (answer.includes("<") || answer.includes(">")) {
          ctx.addIssue({
            code: "custom",
            path: ["respuestasAceptadas", index],
            message: "La respuesta no puede contener < ni >",
          });
        }
      });
    }
  });

export type ManualQuestionInput = z.infer<typeof manualQuestionInputSchema>;

export interface QuestionOptionWriteData {
  orden: number;
  textoHtml: string;
  esCorrecta: boolean;
  fraction: number;
  feedbackHtml?: string | null;
  extraJson?: string | null;
}

export interface QuestionWriteData {
  tipo: string;
  enunciadoHtml: string;
  formato: string;
  defaultGrade: number;
  penalty: number;
  generalFeedbackHtml: string | null;
  noPuntua: boolean;
  datosJson: string | null;
  options: QuestionOptionWriteData[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Convierte el formulario del editor al formato que espera la vista del
 * estudiante y el calificador (`src/lib/scoring.ts`).
 */
export function buildQuestionWriteData(input: ManualQuestionInput): QuestionWriteData {
  const enunciadoHtml = sanitizeQuestionHtml(input.enunciadoHtml);
  const feedbackHtml = sanitizeQuestionHtml(input.generalFeedbackHtml);
  const generalFeedbackHtml = isBlankHtml(feedbackHtml) ? null : feedbackHtml;

  const base = {
    enunciadoHtml,
    formato: "html",
    defaultGrade: round2(input.defaultGrade),
    penalty: 0,
    generalFeedbackHtml,
    noPuntua: false,
  };

  const tipo = input.tipo as ManualQuestionType;

  if (tipo === "MULTICHOICE_SINGLE" || tipo === "MULTICHOICE_MULTIPLE") {
    const single = tipo === "MULTICHOICE_SINGLE";
    const correctas = input.opciones.filter((option) => option.esCorrecta).length;
    const fractionCorrecta = single ? 100 : round2(100 / Math.max(1, correctas));

    return {
      ...base,
      tipo: "MULTICHOICE",
      datosJson: JSON.stringify({ single }),
      options: input.opciones.map((option, index) => ({
        orden: index + 1,
        textoHtml: sanitizeQuestionHtml(option.textoHtml),
        esCorrecta: option.esCorrecta,
        fraction: option.esCorrecta ? fractionCorrecta : 0,
      })),
    };
  }

  if (tipo === "TRUEFALSE") {
    const verdaderoCorrecto = input.respuestaVerdadero !== false;
    return {
      ...base,
      tipo: "TRUEFALSE",
      datosJson: null,
      options: [
        {
          orden: 1,
          textoHtml: "Verdadero",
          esCorrecta: verdaderoCorrecto,
          fraction: verdaderoCorrecto ? 100 : 0,
        },
        {
          orden: 2,
          textoHtml: "Falso",
          esCorrecta: !verdaderoCorrecto,
          fraction: verdaderoCorrecto ? 0 : 100,
        },
      ],
    };
  }

  if (tipo === "SHORTANSWER") {
    const extraJson = JSON.stringify({ usecase: Boolean(input.distinguirMayusculas) });
    return {
      ...base,
      tipo: "SHORTANSWER",
      datosJson: null,
      options: input.respuestasAceptadas
        .map((answer) => answer.trim())
        .filter(Boolean)
        .map((answer, index) => ({
          orden: index + 1,
          textoHtml: answer,
          esCorrecta: true,
          fraction: 100,
          extraJson,
        })),
    };
  }

  // ESSAY: se califica manualmente, sin opciones.
  return {
    ...base,
    tipo: "ESSAY",
    datosJson: null,
    options: [],
  };
}

/** Actualizacion permitida para preguntas importadas que no son manuales. */
export const genericQuestionUpdateSchema = z.object({
  enunciadoHtml: z.string().max(100_000, "El enunciado es demasiado largo"),
  defaultGrade: z
    .number()
    .min(0, "El puntaje no puede ser negativo")
    .max(1000, "El puntaje máximo es 1000"),
  generalFeedbackHtml: z.string().max(50_000).nullish(),
});

export type GenericQuestionUpdate = z.infer<typeof genericQuestionUpdateSchema>;

export function buildGenericQuestionUpdate(input: GenericQuestionUpdate) {
  const feedbackHtml = sanitizeQuestionHtml(input.generalFeedbackHtml);
  return {
    enunciadoHtml: sanitizeQuestionHtml(input.enunciadoHtml),
    defaultGrade: round2(input.defaultGrade),
    generalFeedbackHtml: isBlankHtml(feedbackHtml) ? null : feedbackHtml,
  };
}
