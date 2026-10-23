import { describe, it, expect } from 'vitest';
import { isMultipleAnswerQuestion } from '../lib/questions';
import { parseMoodleXml } from '../lib/moodle-xml/parser';

function multichoiceXml(singleTag: string, answers: Array<{ fraction: number; text: string }>) {
  const answersXml = answers
    .map((answer) => `<answer fraction="${answer.fraction}"><text>${answer.text}</text></answer>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="multichoice">
    <name><text>Prueba</text></name>
    <questiontext><text>¿Cuál es la respuesta?</text></questiontext>
    ${singleTag}
    ${answersXml}
  </question>
</quiz>`;
}

describe('isMultipleAnswerQuestion', () => {
  it('respeta single=true aunque existan varias opciones correctas', () => {
    expect(
      isMultipleAnswerQuestion({
        tipo: 'MULTICHOICE',
        datosJson: JSON.stringify({ single: true }),
        options: [
          { esCorrecta: true, fraction: 100 },
          { esCorrecta: true, fraction: 100 },
        ],
      })
    ).toBe(false);
  });

  it('respeta single=false aunque solo exista una opción correcta', () => {
    expect(
      isMultipleAnswerQuestion({
        tipo: 'MULTICHOICE',
        datosJson: JSON.stringify({ single: false }),
        options: [
          { esCorrecta: true, fraction: 100 },
          { esCorrecta: false, fraction: 0 },
        ],
      })
    ).toBe(true);
  });

  it('infiere multi-respuesta para datos antiguos con más de una correcta', () => {
    expect(
      isMultipleAnswerQuestion({
        tipo: 'MULTICHOICE',
        datosJson: null,
        options: [
          { esCorrecta: true, fraction: 50 },
          { esCorrecta: true, fraction: 50 },
        ],
      })
    ).toBe(true);
  });

  it('infiere respuesta única para datos antiguos con una sola correcta', () => {
    expect(
      isMultipleAnswerQuestion({
        tipo: 'MULTICHOICE',
        datosJson: null,
        options: [
          { esCorrecta: true, fraction: 100 },
          { esCorrecta: false, fraction: 0 },
          { esCorrecta: false, fraction: 0 },
        ],
      })
    ).toBe(false);
  });

  it('no considera multi-respuesta a otros tipos de pregunta', () => {
    expect(
      isMultipleAnswerQuestion({
        tipo: 'TRUEFALSE',
        options: [
          { esCorrecta: true, fraction: 100 },
          { esCorrecta: false, fraction: 0 },
        ],
      })
    ).toBe(false);
  });

  it('usa la fracción positiva cuando esCorrecta no está presente', () => {
    expect(
      isMultipleAnswerQuestion({
        tipo: 'MULTICHOICE',
        datosJson: null,
        options: [{ fraction: 50 }, { fraction: 50 }, { fraction: 0 }],
      })
    ).toBe(true);
  });
});

describe('Moodle parser - atributo single', () => {
  it('guarda single=true en datosJson', () => {
    const result = parseMoodleXml(
      multichoiceXml('<single>true</single>', [
        { fraction: 100, text: 'A' },
        { fraction: 0, text: 'B' },
      ])
    );

    expect(result.questions).toHaveLength(1);
    expect(JSON.parse(result.questions[0].datosJson || '{}')).toEqual({ single: true });
  });

  it('guarda single=false en datosJson', () => {
    const result = parseMoodleXml(
      multichoiceXml('<single>false</single>', [
        { fraction: 50, text: 'A' },
        { fraction: 50, text: 'B' },
      ])
    );

    expect(result.questions).toHaveLength(1);
    expect(JSON.parse(result.questions[0].datosJson || '{}')).toEqual({ single: false });
  });

  it('no guarda datosJson cuando la etiqueta single está ausente', () => {
    const result = parseMoodleXml(
      multichoiceXml('', [
        { fraction: 100, text: 'A' },
        { fraction: 0, text: 'B' },
      ])
    );

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].datosJson).toBeUndefined();
  });
});
