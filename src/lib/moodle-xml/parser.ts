/* eslint-disable @typescript-eslint/no-explicit-any */
import { XMLParser } from 'fast-xml-parser';
import sanitizeHtml from 'sanitize-html';
import * as fs from 'fs';
import * as path from 'path';

export interface ImportReport {
  preguntasImportadas: number;
  preguntasOmitidas: number;
  advertencias: string[];
  detalles: Array<{
    id?: string;
    nombre: string;
    tipo: string;
    estado: 'IMPORTADA' | 'OMITIDA' | 'UNSUPPORTED';
    mensaje?: string;
  }>;
}

export interface ParsedQuestion {
  tipo: string;
  enunciadoHtml: string;
  formato: string;
  defaultGrade: number;
  penalty: number;
  generalFeedbackHtml?: string;
  category?: string;
  orden: number;
  noPuntua: boolean;
  datosJson?: string;
  options: Array<{
    orden: number;
    textoHtml: string;
    esCorrecta: boolean;
    fraction: number;
    feedbackHtml?: string;
    extraJson?: string;
  }>;
}

export interface ParseResult {
  report: ImportReport;
  questions: ParsedQuestion[];
}

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/** Tamaño máximo por archivo embebido (base64 decodificado). */
const MAX_EMBEDDED_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Solo se aceptan imágenes con estos formatos. Evita que un XML malicioso
 * escriba HTML/SVG/JS servible desde el directorio de subidas.
 */
const ALLOWED_FILE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

/** Nombre de archivo seguro: sin separadores, sin `..`, sin caracteres raros. */
const SAFE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._ -]*$/;

const ALLOWED_TAGS = [
  'p', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'img',
  'math', 'sub', 'sup', 'table', 'tr', 'td', 'th', 'span', 'div', 'a'
];

const ALLOWED_ATTRIBUTES = {
  img: ['src', 'alt', 'title', 'width', 'height'],
  a: ['href', 'name', 'target']
};

function sanitize(html: string | undefined): string {
  if (!html) return '';
  return sanitizeHtml(String(html), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    // `data:` se permite solo en imágenes (pegadas/embebidas). Permitirlo en
    // enlaces abre la puerta a navegación a `data:text/html,...`.
    allowedSchemes: ['http', 'https'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const next = { ...attribs };
        if (next.target === '_blank') {
          next.rel = 'noopener noreferrer';
        }
        return { tagName, attribs: next };
      }
    }
  });
}

/**
 * Normaliza y valida el nombre de un archivo embebido en el XML.
 * Devuelve `null` si el nombre intenta escapar del directorio o usa una
 * extensión no permitida.
 */
function sanitizeEmbeddedFileName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  // Rechaza rutas y traversal de forma explícita.
  if (raw.includes('/') || raw.includes('\\') || raw.includes('..')) return null;

  const name = raw.trim();

  if (!name || name === '.' || name === '..') return null;
  if (name.includes('\0')) return null;
  if (name.startsWith('.')) return null;
  if (!SAFE_FILE_NAME.test(name)) return null;

  const extension = path.extname(name).toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.has(extension)) return null;

  return name;
}

function extractText(node: any): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
    return String(node);
  }
  if (node['#text'] !== undefined) return String(node['#text']);
  if (node['__cdata'] !== undefined) return String(node['__cdata']);
  if (node.text !== undefined) return extractText(node.text);
  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }
  if (typeof node === 'object') {
    if (node._) return String(node._);
    for (const key of Object.keys(node)) {
      if (!key.startsWith('@')) {
        const val = extractText(node[key]);
        if (val) return val;
      }
    }
  }
  return '';
}

function extractFiles(questionNode: any, uploadDir: string, publicPath: string): Map<string, string> {
  const fileMap = new Map<string, string>();
  if (!questionNode) return fileMap;

  const files = [];
  if (questionNode.file) {
    if (Array.isArray(questionNode.file)) {
      files.push(...questionNode.file);
    } else {
      files.push(questionNode.file);
    }
  }

  if (questionNode.questiontext && questionNode.questiontext.file) {
    if (Array.isArray(questionNode.questiontext.file)) {
      files.push(...questionNode.questiontext.file);
    } else {
      files.push(questionNode.questiontext.file);
    }
  }

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const root = path.resolve(uploadDir);

  for (const f of files) {
    const fileName = sanitizeEmbeddedFileName(f.name ?? f['@_name']);
    const encoding = f.encoding || f['@_encoding'];
    const content = extractText(f);

    // Se rechaza cualquier nombre inválido, ruta relativa o extensión no
    // permitida antes de tocar el disco.
    if (!fileName || encoding !== 'base64' || !content) continue;

    try {
      const buffer = Buffer.from(content.trim(), 'base64');
      if (buffer.length === 0 || buffer.length > MAX_EMBEDDED_FILE_BYTES) continue;

      const targetPath = path.resolve(root, fileName);
      if (targetPath !== path.join(root, fileName)) continue;

      fs.writeFileSync(targetPath, buffer, { flag: 'w' });
      const publicUrl = publicPath + '/' + encodeURIComponent(fileName);
      fileMap.set(fileName, publicUrl);
      fileMap.set('@@PLUGINFILE@@/' + fileName, publicUrl);
    } catch {
      // Archivo corrupto o sin permisos: se ignora sin interrumpir la importación.
    }
  }

  return fileMap;
}

function replaceFileReferences(html: string, fileMap: Map<string, string>): string {
  let result = html;
  fileMap.forEach((url, key) => {
    result = result.split(key).join(url);
    const baseName = key.replace('@@PLUGINFILE@@/', '');
    result = result.split('@@PLUGINFILE@@/' + baseName).join(url);
  });
  return result;
}

export function parseMoodleXml(xmlContent: string | Buffer, options?: { maxBytes?: number; uploadDir?: string; publicUploadPath?: string }): ParseResult {
  const maxBytes = options?.maxBytes || MAX_IMPORT_BYTES;
  const uploadRoot = process.env.UPLOAD_DIR?.trim()
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), 'storage', 'uploads');
  const uploadDir =
    options?.uploadDir ||
    process.env.MOODLE_UPLOAD_DIR?.trim() ||
    path.join(uploadRoot, 'moodle');
  // Se sirve con /api/uploads/[...path] para que funcione tras `next build`
  // y para no dejar archivos subidos dentro de `public/`.
  const publicUploadPath = options?.publicUploadPath || '/api/uploads/moodle';

  const buffer = Buffer.isBuffer(xmlContent) ? xmlContent : Buffer.from(xmlContent, 'utf8');
  if (buffer.length > maxBytes) {
    throw new Error('Archivo excede el límite máximo permitido');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseTagValue: true,
    trimValues: true,
    cdataPropName: '__cdata'
  });

  let parsed: any;
  try {
    parsed = parser.parse(buffer.toString('utf8'));
  } catch (e: any) {
    return {
      report: {
        preguntasImportadas: 0,
        preguntasOmitidas: 1,
        advertencias: ['Error al parsear XML: ' + e.message],
        detalles: [{ nombre: 'XML raíz', tipo: 'error', estado: 'OMITIDA', mensaje: e.message }]
      },
      questions: []
    };
  }

  const quiz = parsed?.quiz;
  if (!quiz) {
    return {
      report: {
        preguntasImportadas: 0,
        preguntasOmitidas: 1,
        advertencias: ['El archivo XML no contiene un elemento raíz <quiz> válido'],
        detalles: [{ nombre: 'XML raíz', tipo: 'error', estado: 'OMITIDA', mensaje: 'Falta etiqueta quiz' }]
      },
      questions: []
    };
  }

  let rawQuestions = quiz.question;
  if (!rawQuestions) {
    rawQuestions = [];
  } else if (!Array.isArray(rawQuestions)) {
    rawQuestions = [rawQuestions];
  }

  let currentCategory: string | undefined = undefined;
  let preguntasImportadas = 0;
  let preguntasOmitidas = 0;
  const advertencias: string[] = [];
  const detalles: ImportReport['detalles'] = [];
  const questions: ParsedQuestion[] = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const qNode = rawQuestions[i];
    const qType = qNode.type || qNode['@_type'];
    const nameText = extractText(qNode.name?.text || qNode.name) || ('Pregunta ' + (i + 1));

    if (qType === 'category') {
      const catText = extractText(qNode.category?.text || qNode.category);
      if (catText) {
        currentCategory = catText;
      }
      continue;
    }

    if (!qType) {
      preguntasOmitidas++;
      advertencias.push('Pregunta #' + (i + 1) + ' (' + nameText + '): Tipo de pregunta no especificado');
      detalles.push({ nombre: nameText, tipo: 'unknown', estado: 'OMITIDA', mensaje: 'Tipo no especificado' });
      continue;
    }

    const fileMap = extractFiles(qNode, uploadDir, publicUploadPath);
    let rawEnunciado = extractText(qNode.questiontext?.text || qNode.questiontext);
    rawEnunciado = replaceFileReferences(rawEnunciado, fileMap);
    const enunciadoHtml = sanitize(rawEnunciado);

    const defaultGrade = parseFloat(extractText(qNode.defaultgrade)) || 1.0;
    const penalty = parseFloat(extractText(qNode.penalty)) || 0.0;
    let generalFeedbackHtml = extractText(qNode.generalfeedback?.text || qNode.generalfeedback);
    if (generalFeedbackHtml) {
      generalFeedbackHtml = sanitize(replaceFileReferences(generalFeedbackHtml, fileMap));
    }

    const normalizedType = qType.toLowerCase();
    let dbTipo = 'UNSUPPORTED';
    let noPuntua = false;
    let isSupported = true;
    let datosJson: string | undefined;

    if (normalizedType === 'multichoice') {
      dbTipo = 'MULTICHOICE';

      // Moodle distingue respuesta única (`single=true`) de multi-respuesta.
      // Lo guardamos para no inferirlo solo por la cantidad de opciones.
      const singleText = extractText(qNode.single).trim().toLowerCase();
      const singleAttr = String(qNode['@_single'] ?? '').trim().toLowerCase();
      const singleValue = singleText || singleAttr;
      if (singleValue === 'true' || singleValue === '1' || singleValue === 'false' || singleValue === '0') {
        datosJson = JSON.stringify({ single: singleValue === 'true' || singleValue === '1' });
      }
    }
    else if (normalizedType === 'truefalse') dbTipo = 'TRUEFALSE';
    else if (normalizedType === 'shortanswer') dbTipo = 'SHORTANSWER';
    else if (normalizedType === 'numerical') dbTipo = 'NUMERICAL';
    else if (normalizedType === 'matching') dbTipo = 'MATCHING';
    else if (normalizedType === 'essay') dbTipo = 'ESSAY';
    else if (normalizedType === 'description') {
      dbTipo = 'DESCRIPTION';
      noPuntua = true;
    } else {
      isSupported = false;
      dbTipo = 'UNSUPPORTED';
      noPuntua = true;
      advertencias.push('Pregunta #' + (i + 1) + ' (' + nameText + '): Tipo \'' + qType + '\' no soportado, importada como UNSUPPORTED');
      detalles.push({ nombre: nameText, tipo: qType, estado: 'UNSUPPORTED', mensaje: 'Tipo desconocido o no soportado: ' + qType });
    }

    const options: ParsedQuestion['options'] = [];
    const answers = qNode.answer ? (Array.isArray(qNode.answer) ? qNode.answer : [qNode.answer]) : [];

    if (normalizedType === 'multichoice' || normalizedType === 'truefalse' || normalizedType === 'shortanswer' || normalizedType === 'numerical') {
      for (let j = 0; j < answers.length; j++) {
        const ans = answers[j];
        const fraction = parseFloat(ans.fraction || ans['@_fraction'] || '0');
        const ansText = sanitize(replaceFileReferences(extractText(ans.text || ans), fileMap));
        let feedbackHtml = extractText(ans.feedback?.text || ans.feedback);
        if (feedbackHtml) {
          feedbackHtml = sanitize(replaceFileReferences(feedbackHtml, fileMap));
        }

        let extraJson: string | undefined = undefined;
        if (normalizedType === 'numerical' && ans.tolerance) {
          const tol = extractText(ans.tolerance);
          extraJson = JSON.stringify({ tolerance: tol });
        } else if (normalizedType === 'shortanswer') {
          const usecase = extractText(qNode.usecase);
          extraJson = JSON.stringify({ usecase: usecase === '1' || usecase === 'true' });
        }

        options.push({
          orden: j + 1,
          textoHtml: ansText,
          esCorrecta: fraction > 0,
          fraction,
          feedbackHtml: feedbackHtml || undefined,
          extraJson
        });
      }
    } else if (normalizedType === 'matching') {
      const subquestions = qNode.subquestion ? (Array.isArray(qNode.subquestion) ? qNode.subquestion : [qNode.subquestion]) : [];
      for (let j = 0; j < subquestions.length; j++) {
        const sub = subquestions[j];
        const subText = sanitize(replaceFileReferences(extractText(sub.text || sub), fileMap));
        const ansSubText = sanitize(replaceFileReferences(extractText(sub.answer?.text || sub.answer), fileMap));

        options.push({
          orden: j + 1,
          textoHtml: subText,
          esCorrecta: true,
          fraction: 100,
          extraJson: JSON.stringify({ rightMatch: ansSubText })
        });
      }
    }

    if (isSupported) {
      preguntasImportadas++;
      detalles.push({ nombre: nameText, tipo: qType, estado: 'IMPORTADA' });
    } else {
      preguntasImportadas++;
    }

    questions.push({
      tipo: dbTipo,
      enunciadoHtml,
      formato: 'html',
      defaultGrade,
      penalty,
      generalFeedbackHtml: generalFeedbackHtml || undefined,
      category: currentCategory,
      orden: i + 1,
      noPuntua,
      datosJson,
      options
    });
  }

  return {
    report: {
      preguntasImportadas,
      preguntasOmitidas,
      advertencias,
      detalles
    },
    questions
  };
}