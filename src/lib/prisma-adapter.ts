import { PrismaMariaDb } from "@prisma/adapter-mariadb";

/**
 * Crea el adaptador de Prisma para MySQL/MariaDB a partir de DATABASE_URL.
 * Se usa tanto en la aplicación como en los scripts de seed/admin.
 */
export function createPrismaMariaDbAdapter(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está definida");
  }

  const url = new URL(databaseUrl);
  if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
    throw new Error("DATABASE_URL debe usar el esquema mysql:// o mariadb://");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) {
    throw new Error("DATABASE_URL debe incluir el nombre de la base de datos");
  }

  return new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  });
}
