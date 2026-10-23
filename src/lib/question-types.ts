/**
 * Tipos de pregunta que se pueden crear y editar manualmente desde el panel
 * del docente. En la base de datos se guardan con los mismos identificadores
 * que usa la importacion de Moodle, para que la vista del estudiante y el
 * calificador automatico funcionen sin cambios.
 */

export const MANUAL_QUESTION_TYPES = [
  "MULTICHOICE_SINGLE",
  "MULTICHOICE_MULTIPLE",
  "TRUEFALSE",
  "SHORTANSWER",
  "ESSAY",
] as const;

export type ManualQuestionType = (typeof MANUAL_QUESTION_TYPES)[number];

export const MANUAL_QUESTION_TYPE_LABELS: Record<ManualQuestionType, string> = {
  MULTICHOICE_SINGLE: "Opción múltiple (única respuesta)",
  MULTICHOICE_MULTIPLE: "Opción múltiple (varias respuestas)",
  TRUEFALSE: "Falso / Verdadero",
  SHORTANSWER: "Completar (respuesta corta)",
  ESSAY: "Pregunta abierta",
};

export const MANUAL_QUESTION_TYPE_HINTS: Record<ManualQuestionType, string> = {
  MULTICHOICE_SINGLE:
    "El estudiante elige una sola opción. Debe haber exactamente una correcta.",
  MULTICHOICE_MULTIPLE:
    "El estudiante puede marcar varias opciones. El puntaje se reparte entre las correctas.",
  TRUEFALSE: "Dos opciones fijas: Verdadero y Falso.",
  SHORTANSWER:
    "El estudiante escribe la respuesta. Puedes aceptar varias formas y usar * como comodín.",
  ESSAY:
    "Respuesta libre que el docente califica manualmente desde los resultados del intento.",
};

/** Etiquetas para los tipos que existen en la base de datos. */
export const DB_QUESTION_TYPE_LABELS: Record<string, string> = {
  MULTICHOICE: "Opción múltiple",
  TRUEFALSE: "Falso / Verdadero",
  SHORTANSWER: "Completar",
  NUMERICAL: "Numérica",
  MATCHING: "Emparejamiento",
  ESSAY: "Pregunta abierta",
  DESCRIPTION: "Informativa",
  UNSUPPORTED: "No soportada",
};

export interface OptionLikeForEditor {
  textoHtml: string;
  esCorrecta?: boolean;
  fraction?: number;
  extraJson?: string | null;
}

export interface QuestionLikeForEditor {
  id?: string;
  tipo: string;
  enunciadoHtml: string;
  defaultGrade: number;
  generalFeedbackHtml?: string | null;
  datosJson?: string | null;
  options: OptionLikeForEditor[];
}

export interface QuestionEditorPayload {
  id?: string;
  tipo: ManualQuestionType;
  enunciadoHtml: string;
  defaultGrade: number;
  generalFeedbackHtml: string;
  opciones: Array<{ textoHtml: string; esCorrecta: boolean }>;
  respuestaVerdadero: boolean;
  respuestasAceptadas: string[];
  distinguirMayusculas: boolean;
}

/** Tipos de BD que el editor manual puede modificar por completo. */
export function isManualEditableDbType(tipo: string): boolean {
  return ["MULTICHOICE", "TRUEFALSE", "SHORTANSWER", "ESSAY"].includes(tipo);
}

export function isMultipleChoiceDbType(tipo: string): boolean {
  return tipo === "MULTICHOICE";
}

function isOptionCorrect(option: OptionLikeForEditor): boolean {
  return Boolean(option.esCorrecta) || (option.fraction ?? 0) > 0;
}

function singleAnswerFromDatosJson(raw?: string | null): boolean | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { single?: unknown };
    if (typeof data.single === "boolean") return data.single;
  } catch {
    // JSON corrupto: se infiere por la cantidad de correctas.
  }
  return null;
}

export function isMultipleAnswer(question: {
  tipo: string;
  datosJson?: string | null;
  options: OptionLikeForEditor[];
}): boolean {
  if (question.tipo !== "MULTICHOICE") return false;

  const fromJson = singleAnswerFromDatosJson(question.datosJson);
  if (fromJson !== null) return !fromJson;

  return question.options.filter(isOptionCorrect).length > 1;
}

export function describeDbQuestionType(
  tipo: string,
  datosJson?: string | null,
  options: OptionLikeForEditor[] = []
): string {
  if (tipo === "MULTICHOICE") {
    return isMultipleAnswer({ tipo, datosJson, options })
      ? MANUAL_QUESTION_TYPE_LABELS.MULTICHOICE_MULTIPLE
      : MANUAL_QUESTION_TYPE_LABELS.MULTICHOICE_SINGLE;
  }
  return DB_QUESTION_TYPE_LABELS[tipo] ?? tipo;
}

/** Convierte una pregunta de la BD al estado que consume el editor. */
export function questionToEditorPayload(
  question: QuestionLikeForEditor
): QuestionEditorPayload {
  const options = question.options;

  const base: QuestionEditorPayload = {
    id: question.id,
    tipo: "MULTICHOICE_SINGLE",
    enunciadoHtml: question.enunciadoHtml,
    defaultGrade: question.defaultGrade,
    generalFeedbackHtml: question.generalFeedbackHtml ?? "",
    opciones: [],
    respuestaVerdadero: true,
    respuestasAceptadas: [],
    distinguirMayusculas: false,
  };

  if (question.tipo === "MULTICHOICE") {
    return {
      ...base,
      tipo: isMultipleAnswer(question) ? "MULTICHOICE_MULTIPLE" : "MULTICHOICE_SINGLE",
      opciones: options.map((option) => ({
        textoHtml: option.textoHtml,
        esCorrecta: isOptionCorrect(option),
      })),
    };
  }

  if (question.tipo === "TRUEFALSE") {
    const correct = options.find(isOptionCorrect);
    const looksFalse = correct
      ? /fals|^false$|^no$|^f$/i.test(correct.textoHtml.replace(/<[^>]*>/g, "").trim())
      : false;
    return { ...base, tipo: "TRUEFALSE", respuestaVerdadero: !looksFalse };
  }

  if (question.tipo === "SHORTANSWER") {
    let distinguirMayusculas = false;
    try {
      if (options[0]?.extraJson) {
        const extra = JSON.parse(options[0].extraJson) as { usecase?: unknown };
        distinguirMayusculas = Boolean(extra.usecase);
      }
    } catch {
      // Sin preferencia de mayusculas.
    }
    return {
      ...base,
      tipo: "SHORTANSWER",
      respuestasAceptadas: options.map((option) =>
        option.textoHtml.replace(/<[^>]*>/g, "").trim()
      ),
      distinguirMayusculas,
    };
  }

  if (question.tipo === "ESSAY") {
    return { ...base, tipo: "ESSAY" };
  }

  // Tipos importados (MATCHING, NUMERICAL, DESCRIPTION...): el editor solo
  // permite cambiar enunciado, puntaje y retroalimentacion.
  return { ...base, tipo: "SHORTANSWER" };
}
