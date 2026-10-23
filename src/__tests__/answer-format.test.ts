import { describe, it, expect } from 'vitest';
import { formatStudentAnswer } from '../lib/answer-format';

describe('formatStudentAnswer', () => {
  it('muestra el texto de la opción elegida en MULTICHOICE', () => {
    const result = formatStudentAnswer(
      {
        id: 'q1',
        tipo: 'MULTICHOICE',
        options: [
          { id: 'o1', textoHtml: '<p>Eje Y</p>', esCorrecta: false, fraction: 0 },
          { id: 'o2', textoHtml: '<p>Eje Z</p>', esCorrecta: true, fraction: 100 },
        ],
      },
      { respuestaJson: '["o2"]' }
    );

    expect(result).toEqual({
      kind: 'options',
      selected: [{ id: 'o2', textoHtml: '<p>Eje Z</p>' }],
      correct: [{ id: 'o2', textoHtml: '<p>Eje Z</p>' }],
    });
  });

  it('muestra todas las opciones de una respuesta múltiple', () => {
    const result = formatStudentAnswer(
      {
        id: 'q1',
        tipo: 'MULTICHOICE',
        options: [
          { id: 'o1', textoHtml: 'A', esCorrecta: true, fraction: 50 },
          { id: 'o2', textoHtml: 'B', esCorrecta: true, fraction: 50 },
          { id: 'o3', textoHtml: 'C', esCorrecta: false, fraction: 0 },
        ],
      },
      { respuestaJson: '["o1","o2"]' }
    );

    expect(result.kind).toBe('options');
    if (result.kind !== 'options') return;
    expect(result.selected.map((option) => option.textoHtml)).toEqual(['A', 'B']);
    expect(result.correct.map((option) => option.textoHtml)).toEqual(['A', 'B']);
  });

  it('mapea TRUEFALSE a su texto visible', () => {
    const result = formatStudentAnswer(
      {
        id: 'q1',
        tipo: 'TRUEFALSE',
        options: [
          { id: 't1', textoHtml: 'Verdadero', esCorrecta: true, fraction: 100 },
          { id: 't2', textoHtml: 'Falso', esCorrecta: false, fraction: 0 },
        ],
      },
      { respuestaJson: '["t2"]' }
    );

    expect(result).toEqual({
      kind: 'options',
      selected: [{ id: 't2', textoHtml: 'Falso' }],
      correct: [{ id: 't1', textoHtml: 'Verdadero' }],
    });
  });

  it('devuelve la respuesta escrita para SHORTANSWER y NUMERICAL', () => {
    expect(
      formatStudentAnswer(
        { id: 'q1', tipo: 'SHORTANSWER', options: [] },
        { respuestaTexto: 'Madrid' }
      )
    ).toEqual({ kind: 'text', text: 'Madrid' });

    expect(
      formatStudentAnswer(
        { id: 'q2', tipo: 'NUMERICAL', options: [] },
        { respuestaTexto: '10.5' }
      )
    ).toEqual({ kind: 'text', text: '10.5' });
  });

  it('muestra las parejas de MATCHING con su texto y su estado', () => {
    const result = formatStudentAnswer(
      {
        id: 'q1',
        tipo: 'MATCHING',
        options: [
          {
            id: 'm1',
            textoHtml: 'Capital de Francia',
            esCorrecta: true,
            fraction: 100,
            extraJson: JSON.stringify({ rightMatch: 'París' }),
          },
          {
            id: 'm2',
            textoHtml: 'Capital de España',
            esCorrecta: true,
            fraction: 100,
            extraJson: JSON.stringify({ rightMatch: 'Madrid' }),
          },
        ],
      },
      {
        respuestaJson: JSON.stringify({
          pairs: { m1: 'París', m2: 'Barcelona' },
        }),
      }
    );

    expect(result).toEqual({
      kind: 'matching',
      pairs: [
        {
          id: 'm1',
          leftHtml: 'Capital de Francia',
          selected: 'París',
          correct: 'París',
          isCorrect: true,
        },
        {
          id: 'm2',
          leftHtml: 'Capital de España',
          selected: 'Barcelona',
          correct: 'Madrid',
          isCorrect: false,
        },
      ],
    });
  });

  it('muestra un fallback legible si el JSON no se puede interpretar', () => {
    expect(
      formatStudentAnswer(
        {
          id: 'q1',
          tipo: 'MULTICHOICE',
          options: [{ id: 'o1', textoHtml: 'A', esCorrecta: true, fraction: 100 }],
        },
        { respuestaJson: '{"desconocido":true}' }
      )
    ).toEqual({ kind: 'raw', text: '{"desconocido":true}' });
  });

  it('devuelve vacío cuando no hay respuesta', () => {
    expect(
      formatStudentAnswer(
        { id: 'q1', tipo: 'MULTICHOICE', options: [] },
        { respuestaJson: '[]', respuestaTexto: null }
      )
    ).toEqual({ kind: 'empty' });

    expect(
      formatStudentAnswer({ id: 'q2', tipo: 'SHORTANSWER', options: [] }, null)
    ).toEqual({ kind: 'empty' });
  });
});
