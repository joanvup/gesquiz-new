import { describe, expect, it } from 'vitest';
import {
  buildQuestionWriteData,
  manualQuestionInputSchema,
} from '../lib/question-write';
import { sanitizeQuestionHtml } from '../lib/sanitize-question';

function parse(input: unknown) {
  const result = manualQuestionInputSchema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? 'Entrada inválida');
  }
  return result.data;
}

describe('manualQuestionInputSchema', () => {
  it('exige al menos dos opciones en opción múltiple', () => {
    const result = manualQuestionInputSchema.safeParse({
      tipo: 'MULTICHOICE_SINGLE',
      enunciadoHtml: '<p>Pregunta</p>',
      defaultGrade: 1,
      opciones: [{ textoHtml: 'A', esCorrecta: true }],
    });

    expect(result.success).toBe(false);
  });

  it('exige exactamente una correcta en respuesta única', () => {
    const result = manualQuestionInputSchema.safeParse({
      tipo: 'MULTICHOICE_SINGLE',
      enunciadoHtml: '<p>Pregunta</p>',
      defaultGrade: 1,
      opciones: [
        { textoHtml: 'A', esCorrecta: true },
        { textoHtml: 'B', esCorrecta: true },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('permite varias correctas en respuesta múltiple', () => {
    const result = manualQuestionInputSchema.safeParse({
      tipo: 'MULTICHOICE_MULTIPLE',
      enunciadoHtml: '<p>Pregunta</p>',
      defaultGrade: 1,
      opciones: [
        { textoHtml: 'A', esCorrecta: true },
        { textoHtml: 'B', esCorrecta: true },
        { textoHtml: 'C', esCorrecta: false },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rechaza un enunciado sin contenido visible', () => {
    const result = manualQuestionInputSchema.safeParse({
      tipo: 'ESSAY',
      enunciadoHtml: '<p>   </p>',
      defaultGrade: 1,
    });

    expect(result.success).toBe(false);
  });

  it('permite un enunciado que solo contiene una imagen', () => {
    const result = manualQuestionInputSchema.safeParse({
      tipo: 'ESSAY',
      enunciadoHtml: '<p><img src="/api/uploads/quizzes/q/foto.png"></p>',
      defaultGrade: 1,
    });

    expect(result.success).toBe(true);
  });

  it('exige respuestas aceptadas en completar', () => {
    const result = manualQuestionInputSchema.safeParse({
      tipo: 'SHORTANSWER',
      enunciadoHtml: '<p>Completa</p>',
      defaultGrade: 1,
      respuestasAceptadas: ['   '],
    });

    expect(result.success).toBe(false);
  });

  it('rechaza ángulos en las respuestas de completar', () => {
    const result = manualQuestionInputSchema.safeParse({
      tipo: 'SHORTANSWER',
      enunciadoHtml: '<p>Completa</p>',
      defaultGrade: 1,
      respuestasAceptadas: ['a < b'],
    });

    expect(result.success).toBe(false);
  });
});

describe('buildQuestionWriteData', () => {
  it('guarda single=true y fracciones 100/0 en respuesta única', () => {
    const data = buildQuestionWriteData(
      parse({
        tipo: 'MULTICHOICE_SINGLE',
        enunciadoHtml: '<p>¿Capital de Francia?</p>',
        defaultGrade: 2,
        opciones: [
          { textoHtml: '<p>París</p>', esCorrecta: true },
          { textoHtml: '<p>Madrid</p>', esCorrecta: false },
        ],
      })
    );

    expect(data.tipo).toBe('MULTICHOICE');
    expect(JSON.parse(data.datosJson || '{}')).toEqual({ single: true });
    expect(data.options.map((option) => option.fraction)).toEqual([100, 0]);
    expect(data.options.map((option) => option.orden)).toEqual([1, 2]);
  });

  it('reparte el puntaje entre las correctas en respuesta múltiple', () => {
    const data = buildQuestionWriteData(
      parse({
        tipo: 'MULTICHOICE_MULTIPLE',
        enunciadoHtml: '<p>Números pares</p>',
        defaultGrade: 3,
        opciones: [
          { textoHtml: '2', esCorrecta: true },
          { textoHtml: '3', esCorrecta: false },
          { textoHtml: '4', esCorrecta: true },
        ],
      })
    );

    expect(JSON.parse(data.datosJson || '{}')).toEqual({ single: false });
    expect(data.options.map((option) => option.fraction)).toEqual([50, 0, 50]);
  });

  it('genera las opciones Verdadero/Falso', () => {
    const data = buildQuestionWriteData(
      parse({
        tipo: 'TRUEFALSE',
        enunciadoHtml: '<p>El sol es una estrella</p>',
        defaultGrade: 1,
        respuestaVerdadero: false,
      })
    );

    expect(data.tipo).toBe('TRUEFALSE');
    expect(data.options).toHaveLength(2);
    expect(data.options[0]).toMatchObject({
      textoHtml: 'Verdadero',
      esCorrecta: false,
      fraction: 0,
    });
    expect(data.options[1]).toMatchObject({
      textoHtml: 'Falso',
      esCorrecta: true,
      fraction: 100,
    });
  });

  it('guarda las respuestas aceptadas con la preferencia de mayúsculas', () => {
    const data = buildQuestionWriteData(
      parse({
        tipo: 'SHORTANSWER',
        enunciadoHtml: '<p>Completa</p>',
        defaultGrade: 2,
        respuestasAceptadas: [' París ', 'Paris'],
        distinguirMayusculas: true,
      })
    );

    expect(data.tipo).toBe('SHORTANSWER');
    expect(data.options.map((option) => option.textoHtml)).toEqual(['París', 'Paris']);
    expect(data.options.every((option) => option.fraction === 100)).toBe(true);
    expect(JSON.parse(data.options[0].extraJson || '{}')).toEqual({ usecase: true });
  });

  it('no crea opciones para preguntas abiertas', () => {
    const data = buildQuestionWriteData(
      parse({
        tipo: 'ESSAY',
        enunciadoHtml: '<p>Explica</p>',
        defaultGrade: 5,
      })
    );

    expect(data.tipo).toBe('ESSAY');
    expect(data.options).toHaveLength(0);
    expect(data.datosJson).toBeNull();
  });

  it('sanitiza el HTML del enunciado y de las opciones', () => {
    const data = buildQuestionWriteData(
      parse({
        tipo: 'MULTICHOICE_SINGLE',
        enunciadoHtml: '<p>Hola<script>alert(1)</script></p>',
        defaultGrade: 1,
        opciones: [
          { textoHtml: '<p onclick="alert(1)">A</p>', esCorrecta: true },
          { textoHtml: '<p>B</p>', esCorrecta: false },
        ],
      })
    );

    expect(data.enunciadoHtml).not.toContain('<script');
    expect(data.enunciadoHtml).toContain('Hola');
    expect(data.options[0].textoHtml).toBe('<p>A</p>');
  });
});

describe('sanitizeQuestionHtml', () => {
  it('conserva imágenes locales y elimina manejadores de eventos', () => {
    const html = sanitizeQuestionHtml(
      '<p><img src="/api/uploads/quizzes/q/foto.png" onerror="alert(1)"></p>'
    );

    expect(html).toContain('src="/api/uploads/quizzes/q/foto.png"');
    expect(html).not.toContain('onerror');
  });

  it('elimina enlaces con javascript:', () => {
    const html = sanitizeQuestionHtml(
      '<p><a href="javascript:alert(1)">clic</a></p>'
    );

    expect(html).not.toContain('javascript:');
    expect(html).toContain('clic');
  });

  it('agrega rel a los enlaces que abren otra pestaña', () => {
    const html = sanitizeQuestionHtml(
      '<p><a href="https://ejemplo.com" target="_blank">x</a></p>'
    );

    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('mantiene tablas y listas', () => {
    const html = sanitizeQuestionHtml(
      '<table><tbody><tr><td>1</td></tr></tbody></table><ul><li>a</li></ul>'
    );

    expect(html).toContain('<table>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>a</li>');
  });
});
