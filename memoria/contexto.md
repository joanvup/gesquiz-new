# Contexto del proyecto — QuizColegio

> Contexto permanente para agentes. Se lee al inicio de cada sesión.
> Sin historial: el historial va en `bitacora/`.

## Qué es

Sistema integral de gestión y aplicación de quizzes escolares. Permite crear
quizzes, importar preguntas desde Moodle XML o JSON, asignarlos a grupos o
estudiantes, aplicarlos en "modo seguro" (control de infracciones) y revisar
resultados y calificaciones.

Roles: `ADMIN`, `TEACHER`, `STUDENT`.

## Stack

- **Next.js 16.4.2** (App Router). ⚠️ Versión con cambios: leer
  `node_modules/next/dist/docs/` antes de escribir código.
- **React 19.3**, **TypeScript 5**
- **Prisma 7.10.1** + **MySQL 8** vía `@prisma/adapter-mariadb`. Cliente
  generado en `src/generated/prisma` (no versionado).
- **Tailwind CSS 4**; componentes propios en `src/components/ui`
- **Tiptap 3** (editor enriquecido), **Zod 4**, **sanitize-html**,
  **fast-xml-parser**, **exceljs**, **bcryptjs**
- Tests: **Vitest** (unit/integración) + **Playwright** (e2e)

## Estructura del repo

```
src/
  app/                 # App Router (Next 16)
    admin/             # Panel admin: docentes, estudiantes, grupos, importar
    docente/           # Panel docente: quizzes, intentos, resultados
    estudiante/        # Vista estudiante: intentos, presentar
    login/
    api/               # Route handlers REST, agrupados por rol
      admin/ docente/ estudiante/ auth/ uploads/
  components/          # UI compartida (ui/, questions/, theme/)
  lib/                 # Lógica de negocio pura y helpers
  __tests__/           # Tests unitarios/integración (Vitest)
  proxy.ts             # Reemplazo de middleware.ts en Next 16
prisma/
  schema.prisma        # Modelos
  migrations/          # Migraciones MySQL
  seed.ts              # Datos de prueba
  create-admin.ts
e2e/                   # Tests Playwright
lib/moodle-xml/        # Parser Moodle XML (fuera de src/)
docs/                  # Guías (instalación, preguntas manuales)
samples/               # XMLs de ejemplo (válidos e inválidos)
scripts/               # Utilidades (fix-orphan-answers.ts)
storage/               # Uploads en runtime (gitignored)
```

## Modelo de datos (Prisma)

`User`, `Session`, `Group`, `GroupMember`, `Quiz`, `QuizImage`,
`QuizAssignment`, `Question`, `AnswerOption`, `Attempt`, `AttemptAnswer`,
`AuditEvent`, `ImportBatch`.

- Los "enums" (`role`, `status`, `tipo`, `mostrarResultado`, `formato`) son
  `String` en Prisma y se validan con Zod en la capa de aplicación.
- `Question.datosJson` / `AnswerOption.extraJson` guardan datos por tipo
  (opciones, pares, tolerancia, comodines).

## Convenciones

- Validación con **Zod** en `src/lib/*-schemas.ts`.
- HTML de preguntas/feedback se **sanitiza** con `sanitize-html` (lista blanca
  estricta).
- Imágenes: se guardan en `storage/uploads/quizzes/{quizId}/...` y se sirven por
  `/api/uploads/[...path]`. **Nunca** en `public/`.
- Sesión: cookie httpOnly `session` con token en claro; en DB solo el hash
  SHA-256 (`Session.tokenHash`).
- Autorización: `requireUser(roles)` de `src/lib/auth.ts`; `src/proxy.ts` hace el
  chequeo rápido de cookie en rutas protegidas.
- Tests nuevos: archivo en `src/__tests__/`.

## Gotchas críticos

- **Next 16**: `middleware.ts` se renombró a `proxy.ts` (aquí `src/proxy.ts`).
- **Prisma 7**: la config del CLI vive en `prisma7.config.ts`; `output` del
  cliente es obligatorio; el datasource **no** lleva `url` en el schema.
- El bloque `nextjs-agent-rules` de `AGENTS.md` lo **re-escribe `next dev`**; no
  borrarlo (se regenera como cambio sin commitear).
- `npm test` usa la DB real de `.env`: requiere MySQL arriba y `npm run db:seed`.
- En producción, los archivos subidos no se sirven desde `public/`; `storage/`
  debe ser un volumen persistente con permisos de escritura.

## Estado funcional (resumen)

- **Auth**: sesión en DB (token hasheado, revocable) + roles.
- **Admin**: CRUD docentes/estudiantes/grupos, importación Excel, resumen,
  reparación de respuestas huérfanas.
- **Docente**: CRUD quizzes; editor de preguntas manuales (Tiptap, imágenes,
  reordenar); import Moodle XML; import/export JSON; asignación; resultados;
  calificar ensayos; anular/reabrir intentos; visualización de fechas de ventana.
- **Estudiante**: inicio de intento, presentación con modo seguro,
  infracciones y heartbeat, envío y revisación.
  - **Fechas de ventana**: ahora muestra apertura y cierre con formato
    Colombia (UTC-5, hh:mm am/pm) en dos líneas separadas.
- **Login**: credenciales de prueba (`docente@quizcolegio.test` /
  `estudiante1@quizcolegio.test`) solo visibles en modo desarrollo
  (`NODE_ENV !== 'production'`).
- **Conexión MySQL**: `createPrismaMariaDbAdapter` valida `DATABASE_URL`
  (password percent-encoded), usa `connectTimeout` 10 s (el driver trae 1 s),
  `acquireTimeout` 30 s, pool configurable por `DB_POOL_LIMIT` y
  `allowPublicKeyRetrieval: true` (MySQL 8 `caching_sha2_password`). TLS con
  `DB_SSL=true`. `npm run db:check` imprime la causa real de un fallo.
- **Errores de BD en login**: ya no se filtra `err.message` al navegador; el
  detalle (incluido `err.cause`) va al log de PM2 y el cliente recibe 503/500
  genéricos.

> Detalle por sesión en `bitacora/`.

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | ESLint |
| `npm test` | Tests unitarios/integración (Vitest) |
| `npm run test:e2e` | Tests e2e (Playwright) |
| `npm run db:migrate` | Migraciones Prisma |
| `npm run db:seed` | Datos de prueba |
| `npm run db:admin` | Crea/actualiza admin desde `.env` |
| `npm run db:check` | Diagnóstico de conexión MySQL (host, usuario, causa real del fallo) |
| `npm run db:studio` | Prisma Studio |

## Docs relacionados

- `README.md` — instalación, configuración, features para humanos.
- `DECISIONS.md` — log de decisiones técnicas.
- `docs/instalacion_produccion.md` — despliegue en Ubuntu.
- `docs/preguntas-manuales.md` — editor de preguntas e imágenes.
