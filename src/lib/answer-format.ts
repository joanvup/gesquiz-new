export interface AnswerOptionLike {
  id: string;
  textoHtml: string;
  esCorrecta: boolean;
  fraction?: number;
  extraJson?: string | null;
}

export interface AnswerQuestionLike {
  id: string;
  tipo: string;
  options: AnswerOptionLike[];
}

export interface StudentAnswerLike {
  respuestaJson?: string | null;
  respuestaTexto?: string | null;
}

export interface AnswerOptionView {
  id: string;
  textoHtml: string;
}

export interface MatchingPairView {
  id: string;
  leftHtml: string;
  selected: string;
  correct: string;
  isCorrect: boolean;
}

export type FormattedStudentAnswer =
  | { kind: "empty" }
  | { kind: "text"; text: string }
  | { kind: "options"; selected: AnswerOptionView[]; correct: AnswerOptionView[] }
  | { kind: "matching"; pairs: MatchingPairView[] }
  | { kind: "raw"; text: string };

/**
 * Convierte la respuesta almacenada de un estudiante en algo legible para el
 * docente. En la base de datos las preguntas de opción guardan IDs de opciones,
 * no el texto visible, y MATCHING guarda un objeto con las parejas elegidas.
 */
export function formatStudentAnswer(
  question: AnswerQuestionLike,
  answer?: StudentAnswerLike | null
): FormattedStudentAnswer {
  if (!answer) return { kind: "empty" };

  if (question.tipo === "MULTICHOICE" || question.tipo === "TRUEFALSE") {
    const selectedIds = extractSelectedOptionIds(answer.respuestaJson);
    const selected = selectedIds
      .map((id) => question.options.find((option) => option.id === id))
      .filter((option): option is AnswerOptionLike => Boolean(option))
      .map(toOptionView);

    if (selected.length === 0) {
      return emptyOrRaw(answer);
    }

    const correct = question.options
      .filter((option) => option.esCorrecta || (option.fraction ?? 0) > 0)
      .map(toOptionView);

    return { kind: "options", selected, correct };
  }

  if (question.tipo === "MATCHING") {
    const pairs = extractMatchingPairs(answer.respuestaJson);
    if (!pairs) {
      return emptyOrRaw(answer);
    }

    return {
      kind: "matching",
      pairs: question.options.map((option) => {
        const selected =
          pairs[option.id] ??
          pairs[option.textoHtml] ??
          pairs[stripHtml(option.textoHtml)] ??
          "";
        const correct = getRightMatch(option);
        return {
          id: option.id,
          leftHtml: option.textoHtml,
          selected: stripHtml(selected),
          correct: stripHtml(correct),
          isCorrect:
            selected.trim().toLowerCase() === correct.trim().toLowerCase(),
        };
      }),
    };
  }

  if (question.tipo === "DESCRIPTION" || question.tipo === "UNSUPPORTED") {
    return { kind: "empty" };
  }

  const text = extractTextAnswer(answer);
  if (text) {
    return { kind: "text", text };
  }

  return emptyOrRaw(answer);
}

function toOptionView(option: AnswerOptionLike): AnswerOptionView {
  return { id: option.id, textoHtml: option.textoHtml };
}

function extractSelectedOptionIds(raw?: string | null): string[] {
  if (!raw) return [];

  const parsed = parseJson(raw);
  if (Array.isArray(parsed)) {
    return parsed.map(String);
  }
  if (typeof parsed === "string" || typeof parsed === "number") {
    return [String(parsed)];
  }
  if (parsed && typeof parsed === "object") {
    const data = parsed as Record<string, unknown>;
    if (Array.isArray(data.selectedOptionIds)) {
      return data.selectedOptionIds.map(String);
    }
    if (
      typeof data.selectedId === "string" ||
      typeof data.selectedId === "number"
    ) {
      return [String(data.selectedId)];
    }
  }

  return [];
}

function extractTextAnswer(answer: StudentAnswerLike): string {
  const text = answer.respuestaTexto ?? "";
  if (text.trim()) return text;

  const raw = answer.respuestaJson?.trim();
  if (!raw) return "";

  const parsed = parseJson(raw);
  if (typeof parsed === "string" || typeof parsed === "number") {
    return String(parsed);
  }
  if (parsed && typeof parsed === "object") {
    const data = parsed as Record<string, unknown>;
    if (typeof data.text === "string") return data.text;
  }

  return raw;
}

function extractMatchingPairs(raw?: string | null): Record<string, string> | null {
  if (!raw) return null;

  const parsed = parseJson(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const data = parsed as Record<string, unknown>;
  const source =
    data.pairs && typeof data.pairs === "object" && !Array.isArray(data.pairs)
      ? (data.pairs as Record<string, unknown>)
      : data;

  const pairs: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" || typeof value === "number") {
      pairs[key] = String(value);
    }
  }
  return pairs;
}

function getRightMatch(option: AnswerOptionLike): string {
  if (!option.extraJson) return "";
  try {
    const extra = JSON.parse(option.extraJson) as { rightMatch?: unknown };
    return typeof extra.rightMatch === "string" ? extra.rightMatch : "";
  } catch {
    return "";
  }
}

function emptyOrRaw(answer: StudentAnswerLike): FormattedStudentAnswer {
  const text = answer.respuestaTexto ?? "";
  if (text.trim()) {
    return { kind: "text", text };
  }

  const raw = answer.respuestaJson?.trim();
  if (!raw) return { kind: "empty" };

  const parsed = parseJson(raw);
  if (Array.isArray(parsed) && parsed.length === 0) {
    return { kind: "empty" };
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    Object.keys(parsed).length === 0
  ) {
    return { kind: "empty" };
  }

  return { kind: "raw", text: raw };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
