interface RateRecord {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateRecord>();

/** Tope duro para evitar crecimiento de memoria sin límite. */
const MAX_ENTRIES = 10_000;

function pruneExpired(now: number): void {
  for (const [key, record] of store) {
    if (record.resetAt < now) store.delete(key);
  }
}

/**
 * Rate limit en memoria (por proceso).
 *
 * Nota: no es compartido entre instancias. Para despliegues con varias
 * réplicas hay que sustituir `store` por Redis o una tabla de BD.
 */
export function checkRateLimit(identifier: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();

  if (store.size >= MAX_ENTRIES) {
    pruneExpired(now);
    if (store.size >= MAX_ENTRIES) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
  }

  const record = store.get(identifier);

  if (!record || record.resetAt < now) {
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxAttempts) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * IP del cliente. `x-forwarded-for` solo es fiable detrás de un proxy de
 * confianza; se puede desactivar con `TRUST_PROXY=false`.
 */
export function getClientIp(request: Request): string {
  if (process.env.TRUST_PROXY !== "false") {
    const forwarded = request.headers.get("x-forwarded-for");
    const first = forwarded?.split(",")[0]?.trim();
    if (first) return first;
  }

  return request.headers.get("x-real-ip")?.trim() || "127.0.0.1";
}
