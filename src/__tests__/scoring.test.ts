import { describe, it, expect } from 'vitest';
import { gradeQuestion, QuestionForScoring } from '../lib/scoring';

describe('Scoring Engine', () => {
  it('grades multichoice correctly', () => {
    const q: QuestionForScoring = {
      id: 'q1',
      tipo: 'MULTICHOICE',
      defaultGrade: 2,
      penalty: 0,
      noPuntua: false,
      options: [
        { id: 'o1', textoHtml: 'A', esCorrecta: true, fraction: 100 },
        { id: 'o2', textoHtml: 'B', esCorrecta: false, fraction: 0 },
      ],
    };

    const resCorrect = gradeQuestion(q, { questionId: 'q1', respuestaJson: JSON.stringify(['o1']) });
    expect(resCorrect.puntuacion).toBe(2);
    expect(resCorrect.esCorrecta).toBe(true);

    const resWrong = gradeQuestion(q, { questionId: 'q1', respuestaJson: JSON.stringify(['o2']) });
    expect(resWrong.puntuacion).toBe(0);
    expect(resWrong.esCorrecta).toBe(false);
  });

  it('grades truefalse correctly', () => {
    const q: QuestionForScoring = {
      id: 'q2',
      tipo: 'TRUEFALSE',
      defaultGrade: 1,
      penalty: 0,
      noPuntua: false,
      options: [
        { id: 't1', textoHtml: 'Verdadero', esCorrecta: true, fraction: 100 },
        { id: 't2', textoHtml: 'Falso', esCorrecta: false, fraction: 0 },
      ],
    };

    const res = gradeQuestion(q, { questionId: 'q2', respuestaJson: JSON.stringify(['t1']) });
    expect(res.puntuacion).toBe(1);
    expect(res.esCorrecta).toBe(true);
  });

  it('grades shortanswer with wildcards and case insensitivity', () => {
    const q: QuestionForScoring = {
      id: 'q3',
      tipo: 'SHORTANSWER',
      defaultGrade: 1,
      penalty: 0,
      noPuntua: false,
      options: [
        { id: 's1', textoHtml: '*hola*', esCorrecta: true, fraction: 100, extraJson: JSON.stringify({ usecase: false }) },
      ],
    };

    const res = gradeQuestion(q, { questionId: 'q3', respuestaTexto: '  HOLA mundo  ' });
    expect(res.puntuacion).toBe(1);
    expect(res.esCorrecta).toBe(true);
  });

  it('grades numerical with tolerance', () => {
    const q: QuestionForScoring = {
      id: 'q4',
      tipo: 'NUMERICAL',
      defaultGrade: 1,
      penalty: 0,
      noPuntua: false,
      options: [
        { id: 'n1', textoHtml: '10.5', esCorrecta: true, fraction: 100, extraJson: JSON.stringify({ tolerance: '0.2' }) },
      ],
    };

    const resInRange = gradeQuestion(q, { questionId: 'q4', respuestaTexto: '10.6' });
    expect(resInRange.puntuacion).toBe(1);
    expect(resInRange.esCorrecta).toBe(true);

    const resOutRange = gradeQuestion(q, { questionId: 'q4', respuestaTexto: '11.0' });
    expect(resOutRange.puntuacion).toBe(0);
    expect(resOutRange.esCorrecta).toBe(false);
  });

  it('grades matching proportionally', () => {
    const q: QuestionForScoring = {
      id: 'q5',
      tipo: 'MATCHING',
      defaultGrade: 2,
      penalty: 0,
      noPuntua: false,
      options: [
        { id: 'm1', textoHtml: 'Capital de Francia', esCorrecta: true, fraction: 100, extraJson: JSON.stringify({ rightMatch: 'París' }) },
        { id: 'm2', textoHtml: 'Capital de España', esCorrecta: true, fraction: 100, extraJson: JSON.stringify({ rightMatch: 'Madrid' }) },
      ],
    };

    const res = gradeQuestion(q, {
      questionId: 'q5',
      respuestaJson: JSON.stringify({ pairs: { m1: 'París', m2: 'Barcelona' } }),
    });
    expect(res.puntuacion).toBe(1); // 1 out of 2 correct -> 1 point out of 2
    expect(res.esCorrecta).toBe(false);
  });
});
