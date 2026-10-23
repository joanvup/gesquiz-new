# QuizColegio

Sistema integral de gestión y aplicación de quizzes escolares con importación de preguntas desde Moodle XML, modo seguro de examen, control de infracciones y supervisión docente en tiempo real.

## Requisitos

- Node.js 20+ / 24+
- npm
- MySQL 8.x en ejecución (local o remoto)

## Instalación y configuración

1. Clonar el repositorio.
2. Instalar dependencias:

   ```bash
   npm install
   ```

3. Crear la base de datos y el usuario de MySQL. Ejemplo:

   ```sql
   CREATE DATABASE gesquiz
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;

   CREATE USER 'gesquiz'@'%' IDENTIFIED BY 'tu_password';
   GRANT ALL PRIVILEGES ON gesquiz.* TO 'gesquiz'@'%';

   -- Solo para desarrollo local: permite que Prisma Migrate cree la shadow database.
   GRANT CREATE, DROP ON *.* TO 'gesquiz'@'%';
   FLUSH PRIVILEGES;
   ```

4. Crear el archivo `.env` en la raíz del proyecto. Si tienes la plantilla `.env.example`, puedes copiarla:

   ```bash
   cp .env.example .env
   ```

   En PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   Si la plantilla no está disponible, crea `.env` manualmente con las variables del paso siguiente.

5. Configurar la conexión a MySQL en `.env`:

   ```env
   DATABASE_URL="mysql://gesquiz:tu_password@localhost:3306/gesquiz"
   SESSION_SECRET="cambia-esta-clave-en-produccion"
   MAX_IMPORT_MB=10
   ```

6. Aplicar las migraciones:

   ```bash
   npm run db:migrate
   ```

   Para un entorno de producción se puede usar:

   ```bash
   npx prisma migrate deploy
   ```

7. Cargar los datos de prueba:

   ```bash
   npm run db:seed
   ```

8. Iniciar el servidor de desarrollo:

   ```bash
   npm run dev
   ```

La aplicación queda disponible en `http://localhost:3000`.

## Base de datos

- Motor: **MySQL 8**.
- Driver adapter de Prisma: `@prisma/adapter-mariadb`.
- Migración inicial: `prisma/migrations/20261023033959_init_mysql`.
- El proyecto ya no utiliza SQLite.

Si se modifica `prisma/schema.prisma`, crear una nueva migración con:

```bash
npx prisma migrate dev --name nombre_del_cambio
```

## Comandos disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo Next.js. |
| `npm run build` | Genera el build de producción. |
| `npm run start` | Inicia el servidor de producción. |
| `npm run lint` | Ejecuta el linter con ESLint. |
| `npm test` | Ejecuta las pruebas unitarias con Vitest. |
| `npm run test:e2e` | Ejecuta las pruebas End-to-End con Playwright. |
| `npm run db:migrate` | Aplica las migraciones de Prisma. |
| `npm run db:seed` | Carga los datos iniciales de desarrollo. |
| `npm run db:admin` | Crea o actualiza el administrador definido en `.env`. |
| `npm run db:studio` | Abre Prisma Studio para inspeccionar la base de datos. |

## Credenciales de prueba (seed)

- **Administrador**: `admin@quizcolegio.test` / `Admin123!`
- **Docente**: `docente@quizcolegio.test` / `Docente123!`
- **Estudiantes (Grupo A)**:
  - `estudiante1@quizcolegio.test` / `Estudiante123!`
  - `estudiante2@quizcolegio.test` / `Estudiante123!`
  - `estudiante3@quizcolegio.test` / `Estudiante123!`

## Importar archivos Moodle XML

1. Iniciar sesión con una cuenta de rol **Docente**.
2. En el panel docente, seleccionar un quiz existente o crear uno nuevo.
3. Acceder a **Importar XML**, cargar un archivo compatible con Moodle XML (puede utilizarse un ejemplo de `samples/`) y pulsar **Importar**.

> ⚠️ **Importante:** Importar un XML de Moodle **reemplaza todas las preguntas** del quiz (incluidas las creadas manualmente desde la pestaña «Preguntas»). Si el quiz ya tiene intentos, las respuestas asociadas a las preguntas eliminadas también se pierden.

## Preguntas manuales (editor visual)

Desde la pestaña **Preguntas** del editor del quiz (`/docente/quizzes/[id]/editar`), el docente puede crear y gestionar preguntas sin depender de Moodle XML:

- **Tipos soportados**: Opción múltiple (respuesta única / varias respuestas), Falso/Verdadero, Completar (respuesta corta) y Pregunta abierta (ensayo).
- **Editor enriquecido (Tiptap)**: enunciado, opciones y retroalimentación general admiten negrita, cursiva, listas, encabezados, enlaces, tablas e **imágenes**.
- **Inserción de imágenes**: subida directa al servidor (almacenamiento local en `storage/uploads/`, servido por `/api/uploads/...`) o URL externa (`https://…`).
- **Reordenación**: arrastrar y soltar (dnd-kit) para cambiar el orden de las preguntas.
- **Exportar / Importar quiz completo (JSON)**: botón «Exportar» descarga un archivo `.quiz.json` con configuración, preguntas e imágenes (base64). Botón «Importar» permite fusionar (merge) en un quiz existente o crear uno nuevo (desde el panel docente).
- **Importación de quiz completo**: en el panel docente aparece un botón «Importar JSON» que crea un quiz nuevo a partir del archivo exportado (siempre queda como borrador, `publicado: false`).

### Almacenamiento de imágenes

- Los archivos se guardan **fuera de `public/`** en `storage/uploads/quizzes/{quizId}/{uuid}.{ext}` (configurable con `UPLOAD_DIR`).
- Se sirven mediante la ruta `/api/uploads/[...path]`, de modo que funcionan tanto en desarrollo como en producción (`next build` + `next start`).
- Límite por defecto: **5 MB** por imagen (`MAX_IMAGE_MB` en `.env`).
- Validación MIME + *magic bytes* (anti-spoofing).

### Variables de entorno para preguntas manuales

Añade a tu `.env` si deseas cambiar los valores por defecto:

```env
UPLOAD_DIR=/ruta/absoluta/almacenamiento/uploads   # por defecto: ./storage/uploads
MAX_IMAGE_MB=5                                     # máximo MB por imagen
MAX_IMPORT_MB=40                                   # máximo MB para importación JSON completa
```

### Notas de despliegue en producción

- El directorio `storage/` debe ser un **volumen persistente** con permisos de escritura para el usuario que ejecuta la app.
- Incluye `storage/` en tus backups (ver `docs/instalacion_produccion.md`).
- El CSP en `next.config.ts` permite `img-src 'self' data: blob: https:` para que funcionen las imágenes externas.
- **No** uses `public/uploads` para archivos subidos en tiempo de ejecución: Next.js no los sirve tras `next build`.

## Pruebas

Las pruebas unitarias y de integración utilizan la base de datos configurada en `.env`, por lo que MySQL debe estar en ejecución y el seed debe haberse aplicado:

```bash
npm test
```

Las pruebas End-to-End inician automáticamente el servidor de desarrollo:

```bash
npm run test:e2e
```

## Nota de honestidad técnica sobre el modo seguro en navegadores web

El "modo seguro" basado en eventos del navegador (`visibilitychange`, `blur`, detección de salida de pantalla completa) es una medida disuasoria útil para entornos cotidianos, pero **no es infalible**. Un alumno con conocimientos técnicos avanzados puede eludirlo mediante herramientas de desarrollador, múltiples pantallas o scripts externos.

Para exámenes formales o de alta exigencia académica, se recomienda encarecidamente el uso de navegadores especializados como **Safe Exam Browser (SEB)** o la supervisión presencial en aula.
