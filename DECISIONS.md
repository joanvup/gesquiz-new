# Log de Decisiones — QuizColegio (Fase 1 y Fase 2)

1. **Librería de Hash de Contraseñas (cryptjs)**: Se eligió cryptjs en lugar de rgon2 por su compatibilidad nativa en Windows sin requerir compiladores C++ o binarios pesados (evita errores de post-install en entornos Windows).
2. **Gestión de Sesiones (Base de Datos + Token Hasheado)**: Se generan tokens aleatorios de 32 bytes firmados en cookie httpOnly (Secure en prod, Lax). El token se almacena hasheado (SHA-256) en la tabla Session de Prisma para permitir revocación inmediata y control de sesiones activas.
3. **Estrategia de Middleware / Proxy en Next.js 16**: Next.js 16 renombró middleware.ts a proxy.ts. Implementamos src/proxy.ts para verificación rápida de cookie de sesión en rutas protegidas (/docente y /estudiante), redirigiendo a /login si no está presente.
4. **Prisma 7 Configuración**: Prisma 7 traslada la configuración del CLI y datasource a prisma7.config.ts en la raíz (usando defineConfig y env()), exigiendo que el output del cliente sea explícito (src/generated/prisma). Se emplea MySQL 8 como base de datos y el driver adapter @prisma/adapter-mariadb.
5. **Schema Prisma Completo Anticipado**: Se modelaron todas las entidades necesarias para fases futuras (Quizzes, Preguntas, Opciones, Intentos, Respuestas, Auditoría, Lotes de Importación) para evitar migraciones estructurales destructivas posteriores.
6. **Módulo de Importación Moodle XML (Fase 2)**:
   - **ast-xml-parser**: Seleccionado por su alto rendimiento, flexibilidad en atributos (ignoreAttributes: false) y robustez frente a DTDs/XXE.
   - **sanitize-html**: Utilizado para sanitizar rigurosamente los campos HTML de preguntas y retroalimentaciones con una lista blanca estricta de etiquetas y atributos, neutralizando XSS (<script>).
   - **Procesamiento de imágenes Base64**: Decodificación de etiquetas <file> embebidas en formato Moodle XML, almacenamiento en disco (public/uploads/moodle/) y reemplazo automático de referencias @@PLUGINFILE@@/imagen.png por rutas públicas accesibles.
   - **Manejo de tipos no soportados**: Cualquier tipo desconocido (ej. cloze) no interrumpe la importación; se mapea a UNSUPPORTED (
oPuntua = true) y se registra como advertencia en el reporte detallado.
   - **Límite de tamaño**: Validación estricta con límite configurable (MAX_IMPORT_BYTES = 10 MB).
