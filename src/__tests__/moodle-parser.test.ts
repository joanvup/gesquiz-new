import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseMoodleXml } from '../lib/moodle-xml/parser';

describe('Moodle XML Parser', () => {
  it('parses completo.xml correctly and handles all supported types', () => {
    const filePath = path.resolve('samples/completo.xml');
    const xmlContent = fs.readFileSync(filePath, 'utf8');
    const result = parseMoodleXml(xmlContent);

    expect(result.report.preguntasImportadas).toBeGreaterThanOrEqual(9);
    expect(result.report.preguntasOmitidas).toBe(0);
    expect(result.report.advertencias.length).toBeGreaterThan(0);

    const types = result.questions.map(q => q.tipo);
    expect(types).toContain('MULTICHOICE');
    expect(types).toContain('TRUEFALSE');
    expect(types).toContain('SHORTANSWER');
    expect(types).toContain('NUMERICAL');
    expect(types).toContain('MATCHING');
    expect(types).toContain('ESSAY');
    expect(types).toContain('DESCRIPTION');
    expect(types).toContain('UNSUPPORTED');

    const descQ = result.questions.find(q => q.tipo === 'DESCRIPTION');
    expect(descQ?.noPuntua).toBe(true);

    const unsupQ = result.questions.find(q => q.tipo === 'UNSUPPORTED');
    expect(unsupQ?.noPuntua).toBe(true);
  });

  it('parses con-imagenes.xml, extracts base64 image and updates pluginfile reference', () => {
    const filePath = path.resolve('samples/con-imagenes.xml');
    const xmlContent = fs.readFileSync(filePath, 'utf8');
    const result = parseMoodleXml(xmlContent);

    expect(result.report.preguntasImportadas).toBe(1);
    const q = result.questions[0];
    expect(q.enunciadoHtml).not.toContain('@@PLUGINFILE@@');
    expect(q.enunciadoHtml).toContain('/api/uploads/moodle/grafico.png');

    const imagePath = path.resolve('storage/uploads/moodle/grafico.png');
    expect(fs.existsSync(imagePath)).toBe(true);
  });

  it('rejects embedded files that try to escape the upload directory', () => {
    const base64 = Buffer.from('fake-png').toString('base64');
    const xml = `<quiz>
      <question type="description">
        <name><text>Traversal</text></name>
        <questiontext><text>Hola</text>
          <file name="../../../../evil.png" encoding="base64">${base64}</file>
        </questiontext>
      </question>
    </quiz>`;

    const result = parseMoodleXml(xml);
    expect(result.questions[0].enunciadoHtml).not.toContain('@@PLUGINFILE@@');
    expect(result.questions[0].enunciadoHtml).not.toContain('evil');
  });

  it('rejects embedded non-image files', () => {
    const base64 = Buffer.from('<script>alert(1)</script>').toString('base64');
    const xml = `<quiz>
      <question type="description">
        <name><text>XSS file</text></name>
        <questiontext><text>Hola</text>
          <file name="payload.html" encoding="base64">${base64}</file>
        </questiontext>
      </question>
    </quiz>`;

    const result = parseMoodleXml(xml);
    expect(result.questions[0].enunciadoHtml).not.toContain('payload.html');
  });

  it('handles invalido-malicioso.xml safely without XXE crash and sanitizes xss scripts', () => {
    const filePath = path.resolve('samples/invalido-malicioso.xml');
    const xmlContent = fs.readFileSync(filePath, 'utf8');
    const result = parseMoodleXml(xmlContent);

    expect(result).toBeDefined();
    if (result.questions.length > 0) {
      const q = result.questions[0];
      expect(q.enunciadoHtml).not.toContain('<script>');
      expect(q.enunciadoHtml).not.toContain('alert');
    }
  });

  it('rejects files exceeding max size limit', () => {
    const bigContent = '<quiz><question type="description"><name><text>Big</text></name><questiontext><text>Text</text></questiontext></question></quiz>';
    expect(() => parseMoodleXml(bigContent, { maxBytes: 10 })).toThrow();
  });
});
