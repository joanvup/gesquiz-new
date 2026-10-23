import sanitizeHtml from "sanitize-html";
import { htmlToPlainText, isBlankHtml } from "@/lib/html-text";

export { htmlToPlainText, isBlankHtml };

/**
 * Lista blanca de etiquetas para el contenido de preguntas creadas manualmente.
 * Cubre lo que produce el editor Tiptap (parrafos, titulos, listas, enlaces,
 * imagenes, tablas) y mantiene fuera scripts, iframes y estilos inline.
 */
const ALLOWED_TAGS = [
  "p", "br", "hr", "div", "span",
  "b", "strong", "i", "em", "u", "s", "strike", "del", "mark", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "a", "img",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  // Formulas MathML que pueden venir de Moodle o pegarse desde el editor.
  "math", "mrow", "mi", "mo", "mn", "mtext", "ms", "mspace", "msup", "msub",
  "msubsup", "mfrac", "msqrt", "mroot", "mover", "munder", "munderover",
  "mtable", "mtr", "mtd", "mfenced", "mstyle", "semantics", "annotation",
  "annotation-xml",
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "target", "rel", "title"],
  img: ["src", "alt", "title", "width", "height"],
  th: ["colspan", "rowspan", "scope"],
  td: ["colspan", "rowspan"],
  math: ["xmlns", "display"],
  annotation: ["encoding"],
  "annotation-xml": ["encoding"],
};

/**
 * Sanitiza HTML de enunciados, opciones y retroalimentaciones.
 *
 * - Permite rutas relativas (`/api/uploads/...`) y URLs http/https.
 * - Permite `data:` solo en imagenes (pegado desde el portapapeles).
 * - Fuerza `rel="noopener noreferrer"` en enlaces que abren otra pestana.
 */
export function sanitizeQuestionHtml(html: string | null | undefined): string {
  if (!html) return "";

  return sanitizeHtml(String(html), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const next = { ...attribs };
        if (next.target === "_blank") {
          next.rel = "noopener noreferrer";
        }
        return { tagName, attribs: next };
      },
    },
  }).trim();
}

