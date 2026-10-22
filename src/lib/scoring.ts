export interface QuestionForScoring {
  id: string;
  tipo: string;
  defaultGrade: number;
  penalty: number;
  noPuntua: boolean;
  options: Array<{
    id: string;
    textoHtml: string;
    esCorrecta: boolean;
    fraction: number;
    extraJson?: string | null;
  }>;
}

export interface StudentAnswerInput {
  questionId: string;
  respuestaJson?: string | null;
  respuestaTexto?: string | null;
}

export interface QuestionScoreResult {
  questionId: string;
  puntuacion: number;
  esCorrecta: boolean;
  calificadaManualmente: boolean;
}

export function gradeQuestion(
  question: QuestionForScoring,
  answerInput?: StudentAnswerInput | null
): QuestionScoreResult {
  if (question.noPuntua || question.tipo === 'DESCRIPTION' || question.tipo === 'UNSUPPORTED') {
    return {
      questionId: question.id,
      puntuacion: 0,
      esCorrecta: false,
      calificadaManualmente: false,
    };
  }

  if (question.tipo === 'ESSAY') {
    return {
      questionId: question.id,
      puntuacion: 0,
      esCorrecta: false,
      calificadaManualmente: true,
    };
  }

  if (!answerInput || (!answerInput.respuestaJson && !answerInput.respuestaTexto)) {
    return {
      questionId: question.id,
      puntuacion: 0,
      esCorrecta: false,
      calificadaManualmente: false,
    };
  }

  let selectedOptionIds: string[] = [];
  let textAnswer = answerInput.respuestaTexto || '';

  if (answerInput.respuestaJson) {
    try {
      const parsed = JSON.parse(answerInput.respuestaJson);
      if (Array.isArray(parsed)) {
        selectedOptionIds = parsed.map(String);
      } else if (typeof parsed === 'string' || typeof parsed === 'number') {
        selectedOptionIds = [String(parsed)];
      } else if (parsed && typeof parsed === 'object') {
        if (parsed.selectedOptionIds && Array.isArray(parsed.selectedOptionIds)) {
          selectedOptionIds = parsed.selectedOptionIds.map(String);
        } else if (parsed.selectedId) {
          selectedOptionIds = [String(parsed.selectedId)];
        } else if (parsed.text) {
          textAnswer = String(parsed.text);
        }
      }
    } catch {
      if (answerInput.respuestaJson) {
        textAnswer = answerInput.respuestaJson;
      }
    }
  }

  const defaultGrade = question.defaultGrade || 1;

  if (question.tipo === 'MULTICHOICE') {
    let score = 0;
    for (const opt of question.options) {
      const isSelected = selectedOptionIds.includes(opt.id);
      const fraction = opt.fraction / 100;
      if (isSelected) {
        score += fraction * defaultGrade;
      }
    }
    score = Math.max(0, Math.min(defaultGrade, score));
    const esCorrecta = score >= defaultGrade * 0.99;
    return {
      questionId: question.id,
      puntuacion: Number(score.toFixed(4)),
      esCorrecta,
      calificadaManualmente: false,
    };
  }

  if (question.tipo === 'TRUEFALSE') {
    const selectedId = selectedOptionIds[0];
    const correctOpt = question.options.find(o => o.esCorrecta);
    const isCorrect = correctOpt ? correctOpt.id === selectedId : false;
    return {
      questionId: question.id,
      puntuacion: isCorrect ? defaultGrade : 0,
      esCorrecta: isCorrect,
      calificadaManualmente: false,
    };
  }

  if (question.tipo === 'SHORTANSWER') {
    const studentText = textAnswer.trim();
    let isCorrect = false;
    let usecase = false;
    if (question.options[0]?.extraJson) {
      try {
        const extra = JSON.parse(question.options[0].extraJson);
        usecase = !!extra.usecase;
      } catch {}
    }

    for (const opt of question.options) {
      const expected = opt.textoHtml.trim();
      if (matchesShortAnswer(studentText, expected, usecase)) {
        isCorrect = true;
        break;
      }
    }

    return {
      questionId: question.id,
      puntuacion: isCorrect ? defaultGrade : 0,
      esCorrecta: isCorrect,
      calificadaManualmente: false,
    };
  }

  if (question.tipo === 'NUMERICAL') {
    const studentNum = parseFloat(textAnswer);
    let isCorrect = false;
    if (!isNaN(studentNum)) {
      for (const opt of question.options) {
        const correctVal = parseFloat(opt.textoHtml);
        let tolerance = 0;
        if (opt.extraJson) {
          try {
            const extra = JSON.parse(opt.extraJson);
            tolerance = parseFloat(extra.tolerance) || 0;
          } catch {}
        }
        if (!isNaN(correctVal) && Math.abs(studentNum - correctVal) <= tolerance) {
          isCorrect = true;
          break;
        }
      }
    }

    return {
      questionId: question.id,
      puntuacion: isCorrect ? defaultGrade : 0,
      esCorrecta: isCorrect,
      calificadaManualmente: false,
    };
  }

  if (question.tipo === 'MATCHING') {
    let pairs: Record<string, string> = {};
    if (answerInput.respuestaJson) {
      try {
        const parsed = JSON.parse(answerInput.respuestaJson);
        if (parsed && typeof parsed === 'object' && parsed.pairs) {
          pairs = parsed.pairs;
        } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          pairs = parsed;
        }
      } catch {}
    }

    const subquestions = question.options;
    const total = subquestions.length;
    if (total === 0) {
      return { questionId: question.id, puntuacion: 0, esCorrecta: false, calificadaManualmente: false };
    }

    let correctPairs = 0;
    for (const sub of subquestions) {
      let rightMatch = '';
      if (sub.extraJson) {
        try {
          const extra = JSON.parse(sub.extraJson);
          rightMatch = extra.rightMatch || '';
        } catch {}
      }
      const studentMatch = pairs[sub.id] || pairs[sub.textoHtml] || '';
      if (studentMatch.trim().toLowerCase() === rightMatch.trim().toLowerCase()) {
        correctPairs++;
      }
    }

    const score = (correctPairs / total) * defaultGrade;
    const esCorrecta = correctPairs === total;
    return {
      questionId: question.id,
      puntuacion: Number(score.toFixed(4)),
      esCorrecta,
      calificadaManualmente: false,
    };
  }

  return {
    questionId: question.id,
    puntuacion: 0,
    esCorrecta: false,
    calificadaManualmente: false,
  };
}

function matchesShortAnswer(student: string, expected: string, usecase: boolean): boolean {
  let s = student;
  let e = expected;
  if (!usecase) {
    s = s.toLowerCase();
    e = e.toLowerCase();
  }
  if (s === e) return true;

  if (e.includes('*')) {
    const parts = e.split('*').map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return true;
    let idx = 0;
    for (const part of parts) {
      const found = s.indexOf(part, idx);
      if (found === -1) {
        return false;
      }
      idx = found + part.length;
    }
    return true;
  }

  return s === e;
}
