export const GRADE_MIN = 10;
export const GRADE_MAX = 100;

/**
 * Convierte un puntaje crudo a la escala de calificación 10–100.
 *
 * La nota es el porcentaje de aciertos, con un piso de 10:
 * - 0 % a 10 % => 10
 * - 50 % => 50
 * - 100 % => 100
 */
export function toGradeScale(
  score: number | null | undefined,
  maxScore: number | null | undefined
): number | null {
  if (score == null || maxScore == null) return null;
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
    return null;
  }

  const percentage = (score / maxScore) * 100;
  return Math.min(GRADE_MAX, Math.max(GRADE_MIN, Math.round(percentage)));
}
