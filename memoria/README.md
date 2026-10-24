# Memoria del proyecto

Carpeta de trabajo para agentes (IA). **No** es documentación de usuario: es
contexto operativo y bitácora para no re-descubrir el proyecto en cada sesión.

## Archivos

- `contexto.md` — contexto permanente. Se lee al inicio de **cada** sesión.
  Debe ser breve (objetivo: < 150 líneas).
- `bitacora/AAAA-MM.md` — registro cronológico por mes. Se **añade** al final de
  cada tarea significativa.

## Reglas

1. **Al iniciar sesión**: leer `contexto.md` y la última entrada de la bitácora
   del mes actual.
2. **Al terminar una tarea significativa**: añadir una entrada a
   `bitacora/AAAA-MM.md` (fecha, objetivo, cambios, archivos, pendientes, commit).
3. **Actualizar `contexto.md`** solo si cambió arquitectura, stack, estado
   funcional o convenciones.
4. `contexto.md` **no** es un changelog: el historial va en `bitacora/`. Si supera
   ~150 líneas, resumir y mover detalle a la bitácora.
5. **No duplicar** `README.md` / `DECISIONS.md` / `docs/`: enlazar.
