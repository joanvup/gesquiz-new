/**
 * Formatea una fecha/hora en zona horaria de Colombia (UTC-5),
 * devolviendo "EEEE, d 'de' MMMM 'de' yyyy, h:mm a".
 * Si el parámetro es null/undefined, devuelve cadena vacía.
 *
 * Uso: import { formatDateTimeCO } from "@/lib/format-colombia";
 */
export function formatDateTimeCO(date: Date | string | null | undefined): string {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;

  // Ajuste a hora de Colombia (Bogotá, UTC-5).
  // JavaScript usa el timezone del sistema, así que forzosamente ajustamos.
  const offset = d.getTimezoneOffset() / 60; // horas al revés (este = oeste positivo)
  const colombiaOffset = 5; // UTC-5 para Colombia
  const adjusted = new Date(d.getTime() + (colombiaOffset - offset) * 60 * 60 * 1000);

  return adjusted.toLocaleString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Bogota",
  });
}