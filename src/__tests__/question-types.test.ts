import { describe, expect, it } from 'vitest';
import {
  describeDbQuestionType,
  isMultipleAnswer,
  isManualEditableDbType,
  questionToEditorPayload,
} from '../lib/question-types';

describe('questionToEditorPayload', () => {
  it('detecta respuesta única por datosJson', () => {
    const payload = questionToEditorPayload({
      id: 'q1',
      tipo: 'MULTICHOICE',
      enunciadoHtml: '<p>Pregunta</p>',
      defaultGrade: 2,
      datosJson: JSON.stringify({ single: true }),
      options: [
        { textoHtml: 'A', esCorrecta: true, fraction: 100 },
        { textoHtml: 'B', esCorrecta: false, fraction: 0 },
      ],
    });

    expect(payload.tipo).toBe('MULTICHOICE_SINGLE');
    expect(payload.opciones).toEqual([
      { textoHtml: 'A', esCorrecta: true },
      { textoHtml: 'B', esCorrecta: false },
    ]);
  });

  it('detecta respuesta múltiple y usa la fracción positiva', () => {
    const payload = questionToEditorPayload({
      tipo: 'MULTICHOICE',
      enunciadoHtml: '<p>Pregunta</p>',
      defaultGrade: 2,
      datosJson: null,
      options: [
        { textoHtml: 'A', esCorrecta: false, fraction: 50 },
        { textoHtml: 'B', esCorrecta: false, fraction: 50 },
      ],
    });

    expect(payload.tipo).toBe('MULTICHOICE_MULTIPLE');
    expect(payload.opciones.every((option) => option.esCorrecta)).toBe(true);
  });

  it('interpreta Verdadero/Falso', () => {
    const verdadero = questionToEditorPayload({
      tipo: 'TRUEFALSE',
      enunciadoHtml: '<p>Pregunta</p>',
      defaultGrade: 1,
      options: [
        { textoHtml: 'Verdadero', esCorrecta: true, fraction: 100 },
        { textoHtml: 'Falso', esCorrecta: false, fraction: 0 },
      ],
    });
    expect(verdadero.respuestaVerdadero).toBe(true);

    const falso = questionToEditorPayload({
      tipo: 'TRUEFALSE',
      enunciadoHtml: '<p>Pregunta</p>',
      defaultGrade: 1,
      options: [
        { textoHtml: 'Verdadero', esCorrecta: false, fraction: 0 },
        { textoHtml: 'Falso', esCorrecta: true, fraction: 100 },
      ],
    });
    expect(falso.respuestaVerdadero).toBe(false);
  });

  it('recupera respuestas aceptadas y la preferencia de mayúsculas', () => {
    const payload = questionToEditorPayload({
      tipo: 'SHORTANSWER',
      enunciadoHtml: '<p>Completa</p>',
      defaultGrade: 1,
      options: [
        { textoHtml: 'París', esCorrecta: true, fraction: 100, extraJson: '{"usecase":true}' },
        { textoHtml: 'Paris', esCorrecta: true, fraction: 100, extraJson: '{"usecase":true}' },
      ],
    });

    expect(payload.tipo).toBe('SHORTANSWER');
    expect(payload.respuestasAceptadas).toEqual(['París', 'Paris']);
    expect(payload.distinguirMayusculas).toBe(true);
  });
});

describe('describeDbQuestionType', () => {
  it('distingue única y múltiple', () => {
    expect(
      describeDbQuestionType('MULTICHOICE', '{"single":true}', [])
    ).toContain('única');
    expect(
      describeDbQuestionType('MULTICHOICE', '{"single":false}', [])
    ).toContain('varias');
  });

  it('etiqueta tipos importados', () => {
    expect(describeDbQuestionType('MATCHING', null, [])).toBe('Emparejamiento');
  });
});

describe('isManualEditableDbType', () => {
  it('solo permite editar completos los tipos manuales', () => {
    expect(isManualEditableDbType('MULTICHOICE')).toBe(true);
    expect(isManualEditableDbType('TRUEFALSE')).toBe(true);
    expect(isManualEditableDbType('SHORTANSWER')).toBe(true);
    expect(isManualEditableDbType('ESSAY')).toBe(true);
    expect(isManualEditableDbType('MATCHING')).toBe(false);
    expect(isManualEditableDbType('NUMERICAL')).toBe(false);
  });
});

describe('isMultipleAnswer', () => {
  it('usa datosJson antes que la inferencia', () => {
    expect(
      isMultipleAnswer({
        tipo: 'MULTICHOICE',
        datosJson: '{"single":false}',
        options: [{ esCorrecta: true, fraction: 100, textoHtml: 'A' }],
      })
    ).toBe(true);
  });
});
