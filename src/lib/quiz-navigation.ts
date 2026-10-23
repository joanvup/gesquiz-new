export type QuizNavigationDecision = 'navigate' | 'confirm' | 'block';

interface QuizNavigationOptions {
  permitirRetroceso: boolean;
  advertirAlContinuar: boolean;
  currentIndex: number;
  targetIndex: number;
}

/**
 * Decide cómo debe responder la navegación del examen.
 *
 * - `navigate`: carga la pregunta destino.
 * - `confirm`: muestra la advertencia antes de avanzar.
 * - `block`: impide el retroceso cuando el quiz no lo permite.
 */
export function getQuizNavigationDecision({
  permitirRetroceso,
  advertirAlContinuar,
  currentIndex,
  targetIndex,
}: QuizNavigationOptions): QuizNavigationDecision {
  if (permitirRetroceso) return 'navigate';
  if (targetIndex < currentIndex) return 'block';
  if (targetIndex > currentIndex && advertirAlContinuar) return 'confirm';
  return 'navigate';
}
