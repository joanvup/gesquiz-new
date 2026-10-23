/** Utilidades de texto sin dependencias (seguras para el bundle del cliente). */

/** Convierte HTML a texto plano (vistas previas y validaciones). */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** True cuando el HTML no aporta contenido visible (p. ej. `<p></p>`). */
export function isBlankHtml(html: string | null | undefined): boolean {
  if (!html) return true;
  if (/<img\b/i.test(html)) return false;
  return htmlToPlainText(html).length === 0;
}

/** Recorta el HTML para mostrarlo como resumen en una tarjeta. */
export function htmlPreview(html: string, maxLength = 120): string {
  const text = htmlToPlainText(html);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}
