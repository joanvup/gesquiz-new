import { PrismaMariaDb } from "@prisma/adapter-mariadb";

export const DB_DEFAULTS = {
  poolLimit: 10,
  // El conector mariadb usa 1000 ms por defecto, demasiado poco para el primer
  // connect en frío de un servidor de producción.
  connectTimeoutMs: 10_000,
  acquireTimeoutMs: 30_000,
} as const;

export type DatabaseUrlParts = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

/**
 * Detecta los errores de configuración más frecuentes en producción, que de
 * otro modo se manifiestan como un opaco "pool failed to retrieve a connection".
 */
function assertUrlLooksSane(databaseUrl: string) {
  const schemeEnd = databaseUrl.indexOf("://");
  if (schemeEnd === -1) {
    throw new Error(
      "DATABASE_URL debe tener el formato mysql://usuario:contraseña@host:3306/base_de_datos"
    );
  }

  const afterScheme = databaseUrl.slice(schemeEnd + 3);
  const hashIndex = afterScheme.indexOf("#");
  const withoutFragment =
    hashIndex === -1 ? afterScheme : afterScheme.slice(0, hashIndex);
  const pathIndex = withoutFragment.indexOf("/");
  const authority =
    pathIndex === -1 ? withoutFragment : withoutFragment.slice(0, pathIndex);
  const userinfo = authority.includes("@")
    ? authority.slice(0, authority.lastIndexOf("@"))
    : "";

  // Un '#' sin codificar convierte el resto de la URL en fragmento y rompe
  // silenciosamente el host y la base de datos.
  if (databaseUrl.includes("#")) {
    throw new Error(
      "DATABASE_URL contiene '#'. Si forma parte de la contraseña, codifícalo como %23."
    );
  }
  if (authority.includes("?")) {
    throw new Error(
      "DATABASE_URL contiene '?' dentro de la contraseña. Codifícalo como %3F."
    );
  }
  if (userinfo.includes("/")) {
    throw new Error(
      "DATABASE_URL contiene '/' dentro de la contraseña. Codifícalo como %2F."
    );
  }
  if (/%(?![0-9A-Fa-f]{2})/.test(databaseUrl)) {
    throw new Error(
      "DATABASE_URL contiene un '%' que no forma una secuencia válida. Codifícalo como %25."
    );
  }
}

/** Separa y decodifica DATABASE_URL sin abrir ninguna conexión. */
export function parseDatabaseUrl(databaseUrl: string): DatabaseUrlParts {
  assertUrlLooksSane(databaseUrl);

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error(
      "DATABASE_URL no es una URL válida. Codifica los caracteres especiales de la contraseña (@ %40, # %23, % %25, / %2F, : %3A, ? %3F)."
    );
  }

  if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
    throw new Error("DATABASE_URL debe usar el esquema mysql:// o mariadb://");
  }

  let user: string;
  let password: string;
  let database: string;
  try {
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
    database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  } catch {
    throw new Error(
      "DATABASE_URL contiene secuencias de escape inválidas. Codifica la contraseña antes de usarla en la URL."
    );
  }

  if (!database) {
    throw new Error("DATABASE_URL debe incluir el nombre de la base de datos");
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user,
    password,
    database,
  };
}

/**
 * Crea el adaptador de Prisma para MySQL/MariaDB a partir de DATABASE_URL.
 * Se usa tanto en la aplicación como en los scripts de seed/admin.
 *
 * Variables opcionales:
 * - DB_POOL_LIMIT: conexiones simultáneas del pool (10 por defecto).
 * - DB_CONNECT_TIMEOUT_MS: timeout para abrir una conexión (10000).
 * - DB_ACQUIRE_TIMEOUT_MS: timeout para obtener una conexión del pool (30000).
 * - DB_SSL=true: fuerza TLS contra el servidor MySQL.
 * - DB_SSL_REJECT_UNAUTHORIZED=false: acepta certificados autofirmados.
 */
export function createPrismaMariaDbAdapter(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está definida");
  }

  const { host, port, user, password, database } = parseDatabaseUrl(databaseUrl);
  const sslEnabled = process.env.DB_SSL === "true";

  return new PrismaMariaDb({
    host,
    port,
    user,
    password,
    database,
    connectionLimit: readPositiveInt(process.env.DB_POOL_LIMIT, DB_DEFAULTS.poolLimit),
    connectTimeout: readPositiveInt(
      process.env.DB_CONNECT_TIMEOUT_MS,
      DB_DEFAULTS.connectTimeoutMs
    ),
    acquireTimeout: readPositiveInt(
      process.env.DB_ACQUIRE_TIMEOUT_MS,
      DB_DEFAULTS.acquireTimeoutMs
    ),
    // MySQL 8 usa caching_sha2_password por defecto: sin esto, la primera
    // conexión tras un reinicio del servidor falla con ER_CANNOT_RETRIEVE_RSA_KEY.
    allowPublicKeyRetrieval: true,
    ...(sslEnabled
      ? { ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" } }
      : {}),
  });
}
