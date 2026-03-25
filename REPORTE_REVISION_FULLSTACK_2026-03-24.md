# Reporte de Revision Fullstack

Fecha: 2026-03-24
Proyecto: `gestion-programaciones`
Alcance: frontend, backend/aplicacion, base de datos y seguridad

## Resumen Ejecutivo

Se realizo una revision integral del sistema cubriendo:

- componentes frontend y experiencia de usuario
- server actions, autorizacion y flujo de aplicacion
- acceso a datos, esquema Drizzle, integridad y seguridad operacional

La conclusion general es esta:

- la base del proyecto es razonablemente buena en organizacion por features
- `type-check` y tests estan pasando
- hay avances claros en autorizacion con `requireRole()`
- pero todavia existen riesgos relevantes de seguridad, consistencia de permisos, integridad de datos y algunas malas practicas de implementacion

Los hallazgos mas importantes son:

1. Exposicion de credenciales reales en el repositorio
2. Inconsistencia funcional de permisos en campañas para el rol `operativo`
3. Estado de rol obsoleto en `useUser()`
4. Politica de roles aun fragmentada
5. Falta de garantias de integridad y trazabilidad en base de datos y auditoria

## Estado de Validacion

Resultados verificados localmente:

- `pnpm type-check`: OK
- `pnpm test -- --runInBand`: OK, `406/406`
- `pnpm lint`: falla

Observacion:

- `lint` no esta cayendo principalmente por los fixes funcionales de la app
- los errores mas duros restantes estan concentrados en `.claude/skills/...`
- tambien quedan warnings y algunos puntos de higiene tecnica dentro del arbol productivo

## Hallazgo 1

### Titulo

`[P3]` El shell autenticado sigue duplicando lecturas de sesion/perfil

### Ubicacion

- `src/components/layout/app-shell.tsx:10`

### Descripcion

El layout del dashboard ya valida la sesion del usuario, pero `AppShell` vuelve a consultar:

- usuario autenticado
- perfil
- rol

Eso introduce round trips redundantes en una ruta caliente de la aplicacion y mantiene la logica de auth distribuida entre varios niveles del arbol de render.

### Impacto

- consultas repetidas por request
- mayor complejidad para mantener una unica politica de autenticacion/autorizacion
- mas puntos de fallo si cambia el modelo de perfil o sesion

### Recomendacion

- resolver usuario y rol una sola vez en el layout servidor
- pasar esa informacion al shell como props
- evitar lecturas duplicadas de auth/perfil en componentes estructurales

### Prioridad

Baja-Media. No es el bug mas grave, pero si es deuda tecnica clara en una ruta central.

## Hallazgo 2

### Titulo

`[P1]` Credenciales reales expuestas en el repo

### Ubicacion

- `.env.local:1`

### Descripcion

El repositorio contiene variables sensibles en texto plano, incluyendo:

- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `DIRECT_URL`

Estas credenciales tienen impacto alto porque permiten:

- acceso administrativo a Supabase
- acceso directo a Postgres
- bypass de la capa normal de autorizacion de aplicacion

### Impacto

- riesgo critico de seguridad operacional
- exposicion de datos y capacidades administrativas
- posibilidad de escritura, lectura o borrado fuera del flujo normal de negocio

### Recomendacion

- rotar inmediatamente todas las credenciales expuestas
- eliminar secretos reales del repo
- asegurar que `.env.local` no se use como artefacto compartido
- proveer `.env.example` sin valores sensibles

### Prioridad

Alta. Es el hallazgo mas grave de toda la revision.

## Hallazgo 3

### Titulo

`[P1]` Operativo puede listar campañas pero no abrir su detalle

### Ubicacion

- `src/features/campaigns/actions/campaign-actions.ts:107`

### Descripcion

La accion de listado permite al rol `operativo` obtener campañas, pero la accion de detalle no permite ese mismo rol. La pagina de detalle captura el error y responde con `notFound()`.

Eso genera un flujo roto:

- el usuario operativo ve campañas en el listado
- al abrir una, termina en 404

Ademas, el error real de autorizacion queda enmascarado como si el recurso no existiera.

### Impacto

- regresion funcional visible para usuarios operativos
- experiencia inconsistente entre listado y detalle
- diagnostico incorrecto del problema

### Recomendacion

- definir de forma explicita si `operativo` puede o no ver detalle
- alinear `getCampaignsList()` y `getCampaignById()`
- no convertir todo error de acceso en `notFound()`

### Prioridad

Alta. Es un bug funcional directo.

## Hallazgo 4

### Titulo

`[P1]` `useUser` deja el rol obsoleto tras cambios de sesion

### Ubicacion

- `src/hooks/use-user.ts:19`

### Descripcion

El hook escucha cambios de autenticacion y actualiza `user`, pero no vuelve a consultar `profiles.role` cuando entra una sesion nueva. Solo limpia `role` cuando la sesion desaparece.

Eso puede dejar componentes cliente en un estado inconsistente respecto a:

- permisos visibles
- navegacion
- botones condicionados por rol

### Impacto

- UI stale despues de login o refresh parcial
- permisos visuales mal representados
- comportamiento dificil de depurar

### Recomendacion

- recomputar o recargar el rol cuando cambie la sesion
- idealmente centralizar la resolucion de usuario + rol en una sola utilidad o fuente de datos

### Prioridad

Alta. Afecta consistencia funcional del frontend.

## Hallazgo 5

### Titulo

`[P2]` La politica de roles sigue fragmentada y con casts inseguros

### Ubicacion

- `src/app/(dashboard)/campanas/nueva/page.tsx:1`

### Descripcion

Todavia existen paginas del dashboard que resuelven rol manualmente con este patron:

- `createClient()`
- consulta manual a `profiles`
- `profile?.role as Role`

Eso convive con otras zonas que ya usan `parseRole()` y `requireRole()`. El resultado es una politica de permisos repartida y no completamente consolidada.

### Impacto

- duplicacion de logica
- mas round trips
- riesgo de divergencia entre rutas
- type casting inseguro

### Recomendacion

- eliminar `getCurrentRole()` manual donde ya exista alternativa comun
- reemplazar casts por validacion explicita
- centralizar la politica de acceso y resolucion de rol

### Prioridad

Media. Es una causa raiz de varios problemas de consistencia.

## Hallazgo 6

### Titulo

`[P2]` Falta unicidad en asignaciones campaña-personal

### Ubicacion

- `src/lib/db/schema/campaign-assignments.ts:1`

### Descripcion

La tabla de asignaciones no impone una restriccion unica por combinacion `campaign_id + staff_id`. La deduplicacion actual depende de leer antes de insertar desde la capa de aplicacion.

Ese enfoque falla ante:

- concurrencia
- doble submit
- reintentos no idempotentes

### Impacto

- asignaciones duplicadas
- horas infladas
- contadores inconsistentes
- distorsion de calculos operativos

### Recomendacion

- agregar restriccion unica a nivel de base de datos
- complementar con manejo de conflicto en aplicacion

### Prioridad

Media-Alta. Es un problema de integridad de datos.

## Hallazgo 7

### Titulo

`[P2]` `CompanySelector` tiene accesibilidad e interaccion fragiles

### Ubicacion

- `src/features/campaigns/components/company-selector.tsx:1`

### Descripcion

El componente presenta varios problemas de implementacion:

- controles interactivos anidados
- opciones clickeables sin soporte completo de teclado
- errores de creacion absorbidos sin feedback visible

### Impacto

- accesibilidad deficiente
- peor experiencia de usuario
- menor trazabilidad de fallos
- mayor fragilidad en un componente clave del flujo de campañas

### Recomendacion

- corregir estructura semantica e interaccion de teclado
- evitar nesting de controles
- mostrar feedback claro en errores

### Prioridad

Media. No es critico de seguridad, pero si relevante de calidad y UX.

## Hallazgo 8

### Titulo

`[P2]` Empresas dispara lecturas remotas en cada pulsacion

### Ubicacion

- `src/app/(dashboard)/empresas/page.tsx:1`

### Descripcion

La pantalla consulta `getCompaniesList()` desde cliente en cada cambio de texto del input de busqueda. No hay debounce ni una estrategia de datos mas alineada con App Router.

### Impacto

- cascadas de requests
- renders innecesarios
- mezcla de lectura remota con estado local
- complejidad mayor de la necesaria

### Recomendacion

- introducir debounce
- o mover la lectura a server component / route handler / capa de datos mas clara

### Prioridad

Media. Afecta performance y claridad del flujo.

## Hallazgo 9

### Titulo

`[P2]` Los redirects de autorizacion ocultan fallos operativos

### Ubicacion

- `src/app/(dashboard)/campanas/[id]/editar/page.tsx:11`

### Descripcion

En varias paginas, `requireRole()` esta dentro de `try/catch` y cualquier excepcion termina en `redirect('/')`.

Eso mezcla tres categorias distintas:

- usuario sin permiso
- sesion o auth fallida
- fallo operativo de BD o perfil

### Impacto

- peor observabilidad
- diagnostico ambiguo
- dificultad para distinguir incidentes de autorizacion vs infraestructura

### Recomendacion

- distinguir `forbidden` / `unauthorized` de errores tecnicos
- no capturar indiscriminadamente toda excepcion de control de acceso

### Prioridad

Media. Es mas un problema de robustez operativa y claridad de manejo de errores.

## Hallazgo 10

### Titulo

`[P2]` El audit log es best-effort y puede perder trazabilidad en silencio

### Ubicacion

- `src/lib/audit/log-audit.ts:1`

### Descripcion

Si la escritura de auditoria falla, la operacion principal sigue y el error se ignora. Eso significa que la auditoria no funciona como garantia confiable de trazabilidad.

### Impacto

- perdida silenciosa de evidencia operativa
- menor confiabilidad en cambios sensibles
- debilitamiento de controles de seguimiento

### Recomendacion

- definir si ciertas operaciones deben fallar si no se logra auditar
- como minimo, registrar y alertar cuando falle la auditoria

### Prioridad

Media. Afecta cumplimiento, trazabilidad y soporte.

## Sintesis por Area

### Frontend

Principales problemas:

- estado de rol stale en `useUser`
- accesibilidad e interaccion debil en `CompanySelector`
- fetches en cliente por cada pulsacion en `Empresas`
- algunos componentes estructurales con logica de auth o DOM manual innecesaria

### Backend / Aplicacion

Principales problemas:

- inconsistencia de permisos entre listado y detalle de campañas
- manejo de errores de autorizacion demasiado generico
- logica de rol aun distribuida en varias rutas

### Base de Datos / Seguridad

Principales problemas:

- secretos reales expuestos
- falta de unicidad para asignaciones criticas
- auditoria no confiable
- seguridad repartida entre middleware, paginas y acciones sin una sola fuente de verdad

## Recomendaciones Priorizadas

### Fase 1: Critico

1. Rotar y remover credenciales expuestas
2. Corregir el flujo de campañas para `operativo`
3. Arreglar `useUser()` para recomputar rol correctamente

### Fase 2: Estabilizacion

1. Centralizar resolucion de rol
2. Eliminar casts `as Role` restantes
3. Corregir manejo de errores de autorizacion
4. Agregar unicidad en `campaign_assignments`

### Fase 3: Calidad y mantenibilidad

1. Mejorar accesibilidad de `CompanySelector`
2. Reducir fetches cliente en `Empresas`
3. Consolidar auth en layout/shell
4. Fortalecer el audit log

## Conclusion

El proyecto tiene una base funcional buena y una separacion por features bastante aceptable. Sin embargo, todavia no esta en un estado donde se pueda afirmar que todo esta completamente correcto en claridad, seguridad y consistencia.

Los puntos mas urgentes son de seguridad operacional y coherencia de permisos. Luego viene una segunda capa de problemas de mantenibilidad: resolucion de rol fragmentada, integridad dependiente de la aplicacion y componentes cliente con interaccion o estado mejorables.

El sistema esta claramente en mejor estado que en una etapa temprana, pero aun necesita una pasada intencional de remediacion para cerrar riesgos reales antes de seguir sumando complejidad.
