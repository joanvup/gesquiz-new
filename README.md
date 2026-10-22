# QuizColegio

Sistema integral de gestión y aplicación de quizzes escolares con importación de preguntas desde Moodle XML, modo seguro de examen, control de infracciones y supervisión docente en tiempo real.

## Requisitos
- Node.js 20+ / 24+
- npm

## Instalación y Configuración

1. Clonar el repositorio.
2. Instalar dependencias:
   `ash
   npm install
   `
3. Configurar variables de entorno (copiar .env.example a .env):
   `ash
   cp .env.example .env
   `
4. Ejecutar migraciones y semilla de datos de prueba:
   `ash
   npx prisma migrate dev --name init
   npm run db:seed
   `

## Comandos Disponibles
- 
pm run dev: Inicia el servidor de desarrollo Next.js.
- 
pm run build: Genera el build de producción.
- 
pm run start: Inicia el servidor de producción.
- 
pm run lint: Ejecuta el linter (ESLint).
- 
pm run test: Ejecuta las pruebas unitarias con Vitest.
- 
pm run test:e2e: Ejecuta las pruebas End-to-End con Playwright.
- 
pm run db:migrate: Ejecuta migraciones de base de datos Prisma.
- 
pm run db:seed: Carga datos iniciales (docente, estudiantes, grupos, quizzes de ejemplo).
- 
pm run db:studio: Abre Prisma Studio para inspeccionar la base de datos.

## Credenciales de Prueba (Seed)
- **Docente**: docente@quizcolegio.test / Docente123!
- **Estudiantes (Grupo A)**:
  - estudiante1@quizcolegio.test / Estudiante123!
  - estudiante2@quizcolegio.test / Estudiante123!
  - estudiante3@quizcolegio.test / Estudiante123!

## Cómo Importar Archivos Moodle XML
1. Inicie sesión con una cuenta de rol **Docente**.
2. En el panel docente, seleccione un quiz existente o cree uno nuevo.
3. Acceda a la sección de **Importar XML**, cargue un archivo compatible con Moodle XML (puede utilizar los ejemplos en samples/) y pulse Importar.

## Nota de Honestidad Técnica sobre el Modo Seguro en Navegadores Web
El "modo seguro" basado en eventos del navegador (isibilitychange, lur, detección de salida de pantalla completa) es una medida disuasoria útil para entornos cotidianos, pero **no es infalible**. Un alumno con conocimientos técnicos avanzados puede eludirlo mediante herramientas de desarrollador, múltiples pantallas o scripts externos. 

Para exámenes formales o de alta exigencia académica, se recomienda encarecidamente el uso de navegadores especializados como **Safe Exam Browser (SEB)** o la supervisión presencial en aula.
