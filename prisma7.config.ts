// Configuracion del CLI de Prisma 7 (reemplaza a package.json#prisma y al bloque
// `url` del datasource en schema.prisma). Ver DECISIONS.md.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
