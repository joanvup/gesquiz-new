import "dotenv/config";
import mariadb from "mariadb";
import type { Connection, PoolConfig } from "mariadb";
import { DB_DEFAULTS, parseDatabaseUrl } from "../src/lib/prisma-adapter";

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

async function tryConnect(
  label: string,
  config: PoolConfig
): Promise<boolean> {
  let connection: Connection | undefined;
  try {
    connection = await mariadb.createConnection(config);
    const rows = (await connection.query(
      "SELECT VERSION() AS version, CURRENT_USER() AS currentUser, DATABASE() AS db"
    )) as Array<{ version: string; currentUser: string; db: string | null }>;
    const row = rows[0];
    console.log(`[OK]    ${label}`);
    console.log(`        MySQL: ${row?.version}`);
    console.log(`        Usuario autenticado: ${row?.currentUser}`);
    console.log(`        Base de datos: ${row?.db}`);
    return true;
  } catch (err) {
    const error = err as {
      code?: string;
      message?: string;
      errno?: string | number;
      address?: string;
      port?: number;
      cause?: unknown;
    };
    console.error(`[FALLO] ${label}`);
    console.error(`        código: ${error.code ?? "(sin código)"}`);
    console.error(`        mensaje: ${error.message || "(sin mensaje)"}`);
    if (error.address || error.port) {
      console.error(`        destino: ${error.address ?? "?"}:${error.port ?? "?"}`);
    }
    if (error.cause) {
      console.error(`        causa: ${String(error.cause)}`);
    }
    return false;
  } finally {
    if (connection) {
      await connection.end().catch(() => undefined);
    }
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[FALLO] DATABASE_URL no está definida.");
    console.error("        Revisa el archivo .env de la aplicación.");
    process.exitCode = 1;
    return;
  }

  let parts;
  try {
    parts = parseDatabaseUrl(databaseUrl);
  } catch (err) {
    console.error(`[FALLO] ${(err as Error).message}`);
    console.error("        Corrige DATABASE_URL antes de continuar.");
    process.exitCode = 1;
    return;
  }

  const connectTimeout = readPositiveInt(
    process.env.DB_CONNECT_TIMEOUT_MS,
    DB_DEFAULTS.connectTimeoutMs
  );
  const acquireTimeout = readPositiveInt(
    process.env.DB_ACQUIRE_TIMEOUT_MS,
    DB_DEFAULTS.acquireTimeoutMs
  );
  const poolLimit = readPositiveInt(
    process.env.DB_POOL_LIMIT,
    DB_DEFAULTS.poolLimit
  );

  console.log("QuizColegio - diagnóstico de conexión MySQL\n");
  console.log("Configuración detectada:");
  console.log(`  host:        ${parts.host}:${parts.port}`);
  console.log(`  usuario:     ${parts.user}`);
  console.log(`  base datos:  ${parts.database}`);
  console.log(`  contraseña:  ${parts.password.length} caracteres (no se imprime)`);
  console.log(`  pool:        ${poolLimit} conexiones, connect ${connectTimeout} ms, acquire ${acquireTimeout} ms`);
  console.log("");

  const base: PoolConfig = {
    host: parts.host,
    port: parts.port,
    user: parts.user,
    password: parts.password,
    database: parts.database,
    connectionLimit: poolLimit,
    connectTimeout,
    acquireTimeout,
  };

  const variants: Array<{ label: string; config: PoolConfig }> = [
    {
      label: "configuración de la app (allowPublicKeyRetrieval: true)",
      config: { ...base, allowPublicKeyRetrieval: true },
    },
    {
      label: "sin allowPublicKeyRetrieval (driver por defecto)",
      config: { ...base },
    },
    {
      label: "con TLS (ssl: true, certificado no verificado)",
      config: { ...base, allowPublicKeyRetrieval: true, ssl: { rejectUnauthorized: false } },
    },
  ];

  for (const variant of variants) {
    const ok = await tryConnect(variant.label, variant.config);
    if (ok) {
      console.log("\nConexión correcta.");
      process.exitCode = 0;
      return;
    }
    console.log("");
  }

  console.error("No se pudo conectar con ninguna variante.\n");
  console.error("Posibles causas:");
  console.error("  1. Credenciales incorrectas: el usuario no existe para ese host o la contraseña no coincide.");
  console.error("     Revisa `SELECT user, host, plugin FROM mysql.user WHERE user = '...';`");
  console.error("  2. Contraseña con caracteres especiales sin codificar en DATABASE_URL (@ %40, # %23, % %25, / %2F, : %3A, ? %3F).");
  console.error("  3. MySQL no escucha en el host/puerto indicado: `sudo ss -ltnp | grep 3306`.");
  console.error("  4. Conexiones agotadas: `SHOW STATUS LIKE 'Threads_connected';` frente a `SHOW VARIABLES LIKE 'max_connections';`.");
  console.error("  5. Plugin caching_sha2_password sin allowPublicKeyRetrieval ni TLS (MySQL 8).");
  process.exitCode = 1;
}

main().catch((err) => {
  console.error("[FALLO] Error inesperado en el diagnóstico:", err);
  process.exitCode = 1;
});
