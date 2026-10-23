# Preguntas Manuales — Documentación Técnica

## Resumen

Esta funcionalidad permite al docente crear, editar, reordenar y eliminar preguntas directamente desde la interfaz web, sin depender exclusivamente de la importación de XML de Moodle.

## Características principales

| Característica | Detalle |
|----------------|---------|
| **Tipos de pregunta** | MULTICHOICE_SINGLE, MULTICHOICE_MULTIPLE, TRUEFALSE, SHORTANSWER, ESSAY |
| **Editor** | Tiptap (ProseMirror) con barra de herramientas completa |
| **Imágenes** | Subida al servidor (disco local) o URL externa |
| **Reordenación** | Drag & drop con `@dnd-kit` |
| **Export/Import** | JSON autónomo con imágenes en base64 |
| **Merge/Replace** | Por defecto merge (agregar al final); replace bloqueado si hay intentos |

## Arquitectura

### Base de datos

Se añadió el modelo `QuizImage` (migración `20261023131748_add_quiz_images`):

```prisma
model QuizImage {
  id         String   @id @default(cuid())
  quizId     String
  fileName   String   @db.VarChar(255)
  storedPath String   @unique @db.VarChar(500)
  mimeType   String   @db.VarChar(100)
  size       Int
  createdAt  DateTime @default(now())
  quiz       Quiz     @relation(fields: [quizId], references: [id], onDelete: Cascade)
  @@index([quizId])
}
```

La tabla `Question` ya existía y soporta todos los tipos requeridos. Los nuevos tipos manuales se mapean a los existentes:

| Editor | BD `Question.tipo` | `datosJson` |
|--------|-------------------|-------------|
| MULTICHOICE_SINGLE | MULTICHOICE | `{"single":true}` |
| MULTICHOICE_MULTIPLE | MULTICHOICE | `{"single":false}` |
| TRUEFALSE | TRUEFALSE | `null` |
| SHORTANSWER | SHORTANSWER | `null` |
| ESSAY | ESSAY | `null` |

### API Routes

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/docente/quizzes/[id]/questions` | Listar preguntas del quiz |
| POST | `/api/docente/quizzes/[id]/questions` | Crear pregunta |
| PUT | `/api/docente/quizzes/[id]/questions/[questionId]` | Editar pregunta |
| DELETE | `/api/docente/quizzes/[id]/questions/[questionId]` | Eliminar pregunta (bloqueado si hay intentos) |
| POST | `/api/docente/quizzes/[id]/questions/reorder` | Reordenar `{ids: string[]}` |
| GET | `/api/docente/quizzes/[id]/images` | Listar imágenes del quiz |
| POST | `/api/docente/quizzes/[id]/images` | Subir imagen (multipart `file`) |
| GET | `/api/docente/quizzes/[id]/export` | Exportar quiz completo (JSON + base64) |
| POST | `/api/docente/quizzes/[id]/import-json` | Importar JSON en quiz existente (merge/replace) |
| POST | `/api/docente/quizzes/import-json` | Importar JSON creando quiz nuevo (siempre borrador) |
| GET | `/api/uploads/[...path]` | Servir imagen desde `UPLOAD_DIR` |

### Almacenamiento de imágenes

- **Directorio**: `UPLOAD_DIR` (por defecto `./storage/uploads/`)
- **Estructura**: `quizzes/{quizId}/{uuid}.{ext}`
- **URL pública**: `/api/uploads/quizzes/{quizId}/{uuid}.{ext}`
- **Validación**:
  - Tipos MIME: `image/png`, `image/jpeg`, `image/webp`, `image/gif`
  - Magic bytes (anti-spoofing)
  - Tamaño máx: `MAX_IMAGE_MB` (def. 5 MB)

### Export / Import JSON

**Formato (versión 1):**

```json
{
  "version": 1,
  "exportedAt": "2026-10-23T...Z",
  "quiz": { "titulo": "...", "descripcion": "...", ... },
  "questions": [
    { "tipo": "MULTICHOICE", "enunciadoHtml": "<p>...</p>", "defaultGrade": 1, "options": [...] }
  ],
  "images": [
    { "fileName": "foto.png", "mimeType": "image/png", "size": 1234, "url": "/api/uploads/...", "dataBase64": "iVBORw0K..." }
  ]
}
```

**Comportamiento de importación:**

- En quiz existente (`POST /.../import-json`):
  - `reemplazar=false` (merge, por defecto): agrega preguntas al final, `orden` continúa.
  - `reemplazar=true` (replace): **bloqueado** si el quiz tiene `Attempt.count > 0` (cascada borraría `AttemptAnswer`).
  - `aplicarConfiguracion`: opcional, por defecto `false`.
- Nuevo quiz (`POST /api/docente/quizzes/import-json`):
  - Crea quiz con `publicado: false`.
  - Aplica toda la configuración del export.

### Sanitización HTML

Todas las entradas HTML pasan por `sanitizeQuestionHtml()` (`src/lib/sanitize-question.ts`) que permite:

- **Tags**: p, br, h1–h4, ul/ol/li, blockquote, pre/code, a, img, table/thead/tbody/tr/th/td, strong/em/u/s/mark/sub/sup, span, div, hr, math/mrow/mi/mo/mn/…
- **Atributos**: `a[href,target,rel,title]`, `img[src,alt,title,width,height]`, `th/td[colspan,rowspan,scope]`, `math[xmlns,display]`, `annotation[encoding]`
- **Esquemas**: `http`, `https` (global); `data:` solo en `img`.
- **Links `target=_blank`** → se fuerza `rel="noopener noreferrer"`.

### Puntaje máximo (`Quiz.puntajeMaximo`)

Se recalcula automáticamente tras cada mutación (crear/editar/eliminar/reordenar/importar) mediante `recalculateQuizScore(quizId)` → suma `Question.defaultGrade` donde `noPuntua=false`.

### Seguridad

- **Autorización**: `getTeacherQuiz(quizId)` verifica sesión + rol TEACHER/ADMIN + ownership (`quiz.teacherId === user.id` o ADMIN).
- **Rate limit** en subida de imágenes: 60 req/min por usuario.
- **CSP**: `img-src 'self' data: blob: https:` en `next.config.ts`.
- **Eliminación de preguntas**: bloqueada si `Attempt.count > 0` (evita borrado en cascada de `AttemptAnswer`).
- **Replace-import**: mismo bloqueo.

## Componentes UI

| Componente | Ruta | Uso |
|------------|------|-----|
| `RichTextEditor` | `src/components/questions/RichTextEditor.tsx` | Editor Tiptap con botón de imagen (subir/URL) |
| `QuestionEditor` | `src/components/questions/QuestionEditor.tsx` | Modal completo para crear/editar una pregunta |
| `QuizQuestionsTab` | `src/components/questions/QuizQuestionsTab.tsx` | Pestaña «Preguntas» con lista, drag & drop, export/import |

### `RichTextEditor` Props

```ts
interface Props {
  value: string;
  onChange: (html: string) => void;
  quizId: string;              // para endpoint de subida
  placeholder?: string;
  compact?: boolean;           // toolbar reducida (opciones de respuesta)
  disabled?: boolean;
}
```

- `immediatelyRender: false` + `shouldRerenderOnTransaction: true` para compatibilidad SSR/Next.js 16.

## Página de edición del quiz

`src/app/docente/quizzes/[id]/editar/page.tsx` ahora tiene **dos pestañas**:

1. **Configuración** → formulario original (`QuizForm` con `embedded={true}` para ocultar cabecera propia).
2. **Preguntas** → `QuizQuestionsTab` con todas las operaciones.

Al cambiar de pestaña, la configuración permanece montada (oculta con `hidden`) para no perder estado no guardado.

## Despliegue en producción

### Checklist

- [ ] `UPLOAD_DIR` apunta a un **volumen persistente** con permisos de escritura.
- [ ] `storage/` incluido en backups (ver `docs/instalacion_produccion.md`).
- [ ] `MAX_IMAGE_MB` / `MAX_IMPORT_MB` ajustados según política.
- [ ] `npx prisma migrate deploy` aplica la migración `add_quiz_images`.
- [ ] CSP en `next.config.ts` incluye `https:` en `img-src`.
- [ ] Nginx `client_max_body_size` ≥ `MAX_IMPORT_MB` (p.ej. `15m` para 10 MB + multipart overhead).

### Backups recomendados

- **DB**: `mysqldump --single-transaction quizcolegio_prod`
- **Uploads**: `tar czf uploads-$(date +%F).tar.gz -C /var/www/quizcolegio/app storage`
- **Externo**: Restic a S3/B2 (ver `docs/instalacion_produccion.md`).

## Pruebas

- Unitarias: `src/__tests__/question-write.test.ts`, `question-types.test.ts`
- E2E: `e2e/manual-questions.spec.ts`
- Ejecutar: `npm test && npx playwright test e2e/manual-questions.spec.ts`

## Migración desde Moodle XML existente

- Las preguntas importadas via XML **siguen funcionando** (tipos: MATCHING, NUMERICAL, DESCRIPTION, etc.).
- En la pestaña Preguntas se muestran con badge «Importada» y solo permiten editar enunciado/puntaje/retroalimentación.
- Exportar un quiz mezcla preguntas manuales + importadas; al importar en otro quiz se conservan todos los tipos.

## Limitaciones conocidas

- No hay soporte para arrastrar imágenes desde el portapapeles directamente al editor (solo botón de subida / URL).
- La validación de `SHORTANSWER` rechaza `<` y `>` en las respuestas aceptadas (evita conflictos con el calificador).
- `MATCHING` y `NUMERICAL` no son editables manualmente; requieren re-importar XML o editar la BD.
- Imágenes en `public/uploads/moodle/` (importaciones antiguas) no están registradas en `QuizImage`; el export las detecta y las incluye, pero en producción **deben servirse también vía `/api/uploads/...` o Nginx** para que no fallen tras rebuild.

## Roadmap / Ideas futuras

- Soporte para arrastrar-imagen-desde-portapapeles en Tiptap.
- Duplicar pregunta.
- Vista previa de estudiante dentro del editor.
- Historial de cambios (auditoría) por pregunta.
- Copiar preguntas entre quizzes.