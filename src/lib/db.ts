import { PrismaClient } from "@/generated/prisma/client";
import { createPrismaMariaDbAdapter } from "@/lib/prisma-adapter";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: createPrismaMariaDbAdapter(),
  });

// Se conserva también en producción: si Next.js vuelve a evaluar este módulo
// (route handlers, server components) reutiliza el cliente en lugar de abrir
// un pool nuevo por cada evaluación.
globalForPrisma.prisma = db;
