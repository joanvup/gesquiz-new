-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "instrucciones" TEXT,
    "permitirRetroceso" BOOLEAN NOT NULL DEFAULT true,
    "advertirAlContinuar" BOOLEAN NOT NULL DEFAULT false,
    "tiempoLimiteMinutos" INTEGER,
    "ordenAleatorioPreguntas" BOOLEAN NOT NULL DEFAULT false,
    "ordenAleatorioOpciones" BOOLEAN NOT NULL DEFAULT false,
    "intentosPermitidos" INTEGER NOT NULL DEFAULT 1,
    "ventanaAbre" DATETIME,
    "ventanaCierra" DATETIME,
    "mostrarResultado" TEXT NOT NULL DEFAULT 'NOTA',
    "modoSeguro" BOOLEAN NOT NULL DEFAULT true,
    "maxInfracciones" INTEGER NOT NULL DEFAULT 3,
    "puntajeMaximo" REAL NOT NULL DEFAULT 0,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quiz_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Quiz" ("createdAt", "descripcion", "id", "instrucciones", "intentosPermitidos", "maxInfracciones", "modoSeguro", "mostrarResultado", "ordenAleatorioOpciones", "ordenAleatorioPreguntas", "permitirRetroceso", "publicado", "puntajeMaximo", "teacherId", "tiempoLimiteMinutos", "titulo", "updatedAt", "ventanaAbre", "ventanaCierra") SELECT "createdAt", "descripcion", "id", "instrucciones", "intentosPermitidos", "maxInfracciones", "modoSeguro", "mostrarResultado", "ordenAleatorioOpciones", "ordenAleatorioPreguntas", "permitirRetroceso", "publicado", "puntajeMaximo", "teacherId", "tiempoLimiteMinutos", "titulo", "updatedAt", "ventanaAbre", "ventanaCierra" FROM "Quiz";
DROP TABLE "Quiz";
ALTER TABLE "new_Quiz" RENAME TO "Quiz";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
