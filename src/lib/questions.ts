export interface QuestionLike {
  tipo: string;
  datosJson?: string | null;
  options: Array<{
    esCorrecta?: boolean;
    fraction?: number;
  }>;
}

/**
 * Indica si una pregunta MULTICHOICE permite seleccionar más de una opción.
 *
 * Para importaciones nuevas se usa el atributo `<single>` de Moodle guardado
 * en `datosJson`. Para preguntas antiguas se infiere contando las opciones
 * correctas (o con fracción positiva).
 */
export function isMultipleAnswerQuestion(question: QuestionLike): boolean {
  if (question.tipo !== "MULTICHOICE") return false;

  if (question.datosJson) {
    try {
      const data = JSON.parse(question.datosJson) as { single?: unknown };
      if (typeof data.single === "boolean") return !data.single;
    } catch {
      // Si el JSON está corrupto, usamos la inferencia.
    }
  }

  return question.options.filter(
    (option) => option.esCorrecta || (option.fraction ?? 0) > 0
  ).length > 1;
}
