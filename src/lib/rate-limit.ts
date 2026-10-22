interface RateRecord {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateRecord>();

export function checkRateLimit(identifier: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  let record = store.get(identifier);

  if (!record || record.resetAt < now) {
    record = { count: 1, resetAt: now + windowMs };
    store.set(identifier, record);
    return true;
  }

  if (record.count >= maxAttempts) {
    return false;
  }

  record.count++;
  return true;
}
