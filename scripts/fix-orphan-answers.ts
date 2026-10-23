#!/usr/bin/env tsx
/**
 * Repara AttemptAnswer con IDs de opciones huérfanos.
 *
 * Estrategia:
 * 1. Para cada AttemptAnswer con respuestaJson (array de optionIds):
 *    - Verifica qué IDs ya no existen en AnswerOption
 *    - Intenta emparejar por texto de la opción (textoHtml normalizado)
 *    - Si hay coincidencia única → actualiza con el nuevo ID
 *    - Si hay ambigüedad o no hay match → deja como está y reporta
 */

import { db } from "../src/lib/db";

function normalizeText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&/gi, "&")
    .replace(/</gi, "<")
    .replace(/>/gi, ">")
    .replace(/"/gi, '"')
    .replace(/'/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function main() {
  console.log("🔍 Buscando respuestas con IDs huérfanos...\n");

  // Cargar todas las opciones actuales indexadas por ID y por texto normalizado
  const allOptions = await db.answerOption.findMany({
    select: { id: true, questionId: true, textoHtml: true },
  });

  const optionById = new Map(allOptions.map((o) => [o.id, o]));
  const optionsByQuestion = new Map<string, typeof allOptions>();
  for (const o of allOptions) {
    const arr = optionsByQuestion.get(o.questionId) || [];
    arr.push(o);
    optionsByQuestion.set(o.questionId, arr);
  }

  // Buscar todas las respuestas que tengan respuestaJson (array de IDs)
  const answers = await db.attemptAnswer.findMany({
    where: {
      respuestaJson: { not: null },
    },
    select: {
      id: true,
      questionId: true,
      respuestaJson: true,
      attempt: { select: { quizId: true } },
    },
  });

  let totalFixed = 0;
  let totalOrphaned = 0;
  const problems: Array<{ answerId: string; questionId: string; orphanIds: string[]; reason: string }> = [];

  for (const ans of answers) {
    let raw: string;
    try {
      raw = ans.respuestaJson!;
    } catch {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    if (!Array.isArray(parsed)) continue;

    const optionIds: string[] = parsed.map(String);
    const questionOptions = optionsByQuestion.get(ans.questionId) || [];
    const questionOptionByText = new Map<string, string[]>();
    for (const o of questionOptions) {
      const key = normalizeText(o.textoHtml);
      const arr = questionOptionByText.get(key) || [];
      arr.push(o.id);
      questionOptionByText.set(key, arr);
    }

    const newIds: string[] = [];
    const orphanIds: string[] = [];

    for (const oldId of optionIds) {
      if (optionById.has(oldId)) {
        newIds.push(oldId);
        continue;
      }
      totalOrphaned++;

      // Intentar match por texto: buscar la opción en la pregunta actual que tenga el mismo texto
      // Necesitamos el texto original de la opción vieja. Como no la tenemos, hacemos match heurístico:
      // Si solo hay una opción en la pregunta actual, usamos esa.
      // Si hay varias, no podemos saber cuál era → marcamos como problema.
      if (questionOptions.length === 1) {
        newIds.push(questionOptions[0].id);
        console.log(`  ✓ Match único por pregunta: ${ans.id} → ${questionOptions[0].id}`);
      } else {
        // Buscar en TODAS las opciones del quiz por texto similar (útil si el texto no cambió)
        // Pero como no tenemos el texto viejo, no podemos. Reportamos.
        orphanIds.push(oldId);
      }
    }

    if (orphanIds.length > 0) {
      problems.push({
        answerId: ans.id,
        questionId: ans.questionId,
        orphanIds,
        reason: orphanIds.length === optionIds.length
          ? "Todas las opciones huérfanas; no hay match único"
          : `${orphanIds.length} de ${optionIds.length} huérfanas`,
      });
    } else if (newIds.length !== optionIds.length) {
      // Esto no debería pasar con la lógica de arriba, pero por si acaso
      problems.push({
        answerId: ans.id,
        questionId: ans.questionId,
        orphanIds: [],
        reason: "Discrepancia en conteo",
      });
    } else if (JSON.stringify(newIds) !== JSON.stringify(optionIds)) {
      // Hubo cambios: actualizar
      await db.attemptAnswer.update({
        where: { id: ans.id },
        data: { respuestaJson: JSON.stringify(newIds) },
      });
      totalFixed++;
      console.log(`  🔧 Actualizado ${ans.id}: [${optionIds.join(", ")}] → [${newIds.join(", ")}]`);
    }
  }

  console.log("\n📊 Resumen:");
  console.log(`  Respuestas procesadas: ${answers.length}`);
  console.log(`  IDs huérfanos detectados: ${totalOrphaned}`);
  console.log(`  Respuestas corregidas: ${totalFixed}`);
  console.log(`  Problemas sin resolver: ${problems.length}`);

  if (problems.length > 0) {
    console.log("\n⚠️  Requieren revisión manual:");
    for (const p of problems) {
      console.log(`  - Answer ${p.answerId} (Q:${p.questionId}): ${p.reason}`);
      console.log(`    IDs huérfanos: ${p.orphanIds.join(", ")}`);
    }
  }

  await db.$disconnect();
  console.log("\n✅ Fin.");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});