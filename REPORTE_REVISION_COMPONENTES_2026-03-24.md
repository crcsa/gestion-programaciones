# Reporte de Revision Tecnica

Fecha: 2026-03-24
Proyecto: `gestion-programaciones`

## Alcance

La revision se enfoco en los componentes y capas principales que concentran autenticacion, autorizacion, shell de navegacion, resolucion de rol de usuario y componentes compartidos con impacto transversal en la aplicacion.

Se revisaron especialmente estos archivos y flujos:

- `src/features/notifications/components/notification-bell.tsx`
- `src/lib/utils/constants.ts`
- `src/features/auth/actions/auth-actions.ts`
- `src/features/auth/components/role-gate.tsx`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/mobile-nav.tsx`
- `src/app/(dashboard)/personal/nuevo/page.tsx`
- archivos relacionados con obtencion de rol actual en paginas del dashboard

## Resumen Ejecutivo

La aplicacion tiene una base razonablemente ordenada por features y los flujos principales compilan y pasan pruebas, pero todavia presenta problemas importantes de consistencia arquitectonica. Los hallazgos mas relevantes no son errores de sintaxis o tipado basico, sino defectos de diseno que ya estan provocando comportamiento inconsistente en navegacion y autorizacion.

El patron dominante encontrado fue este:

- la logica de autenticacion y rol esta duplicada en varios puntos
- se usan type casts evitables para forzar tipos en vez de validar datos
- parte de la autorizacion se esta resolviendo en cliente cuando deberia cerrarse en servidor
- la navegacion no tiene una unica fuente de verdad

En conjunto, esto aumenta el riesgo de regresiones funcionales, especialmente cuando se agregan nuevas rutas, roles o pantallas administrativas.

## Estado de Validacion

Se ejecuto validacion automatica del proyecto con estos resultados:

- `pnpm type-check`: exitoso
- `pnpm test -- --runInBand`: exitoso, 32 archivos de prueba y 406 pruebas aprobadas
- `pnpm lint`: falla

Observacion importante:

- Parte del ruido de `lint` proviene de carpetas ajenas al codigo productivo como `.claude/` y `coverage/`
- Aun asi, tambien hay errores reales dentro del codigo de la aplicacion, especialmente en `src/features/notifications/components/notification-bell.tsx`

## Hallazgo 1

### Titulo

`[P2]` Este componente rompe lint por efectos con `setState` sincronico

### Ubicacion

- `src/features/notifications/components/notification-bell.tsx:49`

### Descripcion

El componente `NotificationBell` inicializa `readIds` mediante un `useEffect` que hace `setReadIds(getReadIds())`, y ademas dispara la carga de notificaciones desde otro `useEffect` que llama `setLoading(true)` de forma inmediata dentro del cuerpo del efecto.

Ese patron hoy entra en conflicto con la regla `react-hooks/set-state-in-effect`, que considera problematico disparar actualizaciones sincronicas de estado dentro del efecto cuando esa logica podria resolverse mejor:

- en el inicializador de `useState`
- en un handler explicito
- en una abstraccion de datos

### Impacto

- El repositorio no pasa `pnpm lint`
- Se introducen renders adicionales evitables
- El componente mezcla lectura de `localStorage`, apertura de menu y carga remota en una sola pieza de estado local
- El costo de mantenimiento aumenta porque el componente acumula varias responsabilidades

### Riesgo tecnico

El problema no necesariamente rompe la UI hoy, pero ya esta formalizado como error por la configuracion de lint del proyecto. Eso significa que cualquier pipeline seria o verificacion local estricta quedara bloqueada mientras esta implementacion siga igual.

### Recomendacion

- Inicializar `readIds` con una funcion lazy en `useState`
- Mover la carga de notificaciones a un handler controlado por apertura del dropdown o a un hook especializado
- Separar estado derivado de estado persistido

### Prioridad

Media. No parece romper negocio directamente, pero si afecta calidad de integracion y disciplina de mantenimiento.

## Hallazgo 2

### Titulo

`[P1]` Redirect post-login apunta a una ruta inexistente

### Ubicacion

- `src/lib/utils/constants.ts:8`
- `src/features/auth/actions/auth-actions.ts:44`

### Descripcion

El mapa `ROLE_DEFAULT_ROUTES` define el destino por defecto para cada rol luego del login. Para `operativo`, el valor configurado es `/mi-calendario`.

Sin embargo, la navegacion real y las rutas visibles del sistema usan `/mi-agenda`, no `/mi-calendario`.

Eso significa que un usuario operativo autenticado puede terminar redirigido a una ruta inexistente o fuera del flujo correcto justo despues de iniciar sesion.

### Impacto

- Regresion funcional visible para usuarios operativos
- Posible llegada a 404 o pantalla incorrecta tras login
- Inconsistencia entre navegacion, breadcrumbs y logica de autenticacion

### Riesgo tecnico

Este hallazgo ya cruza la linea entre deuda tecnica y bug real. No es una preocupacion teorica: el codigo de login usa ese mapa directamente y la discrepancia ya esta materializada.

### Recomendacion

- Corregir `ROLE_DEFAULT_ROUTES.operativo` para que apunte a la ruta real
- Centralizar las rutas por rol y reutilizarlas en login, navegacion y breadcrumbs
- Agregar una prueba para asegurar que cada rol redirige a una ruta existente

### Prioridad

Alta. Es un defecto funcional directo en el flujo de autenticacion.

## Hallazgo 3

### Titulo

`[P1]` El control de acceso aqui es solo visual, no del lado servidor

### Ubicacion

- `src/app/(dashboard)/personal/nuevo/page.tsx:21`
- relacionado con `src/features/auth/components/role-gate.tsx`

### Descripcion

La pagina `personal/nuevo` obtiene el rol actual y carga datos de negocio (`getTrainingAreas`) antes de envolver el contenido con `RoleGate`.

El problema es que `RoleGate` es un componente cliente que, en caso de acceso no permitido, solo retorna el `fallback` o `null`. Eso no constituye un cierre real del acceso del lado servidor:

- no hace `redirect`
- no devuelve `forbidden`
- no evita que el servidor resuelva la pagina y sus datos previos

En otras palabras, la restriccion es principalmente visual.

### Impacto

- El control de acceso queda repartido entre cliente y servidor
- Se pueden cargar datos antes de decidir si el usuario esta autorizado
- La seguridad y el comportamiento quedan mas fragiles ante refactors o cambios de hidratacion
- El mismo patron puede repetirse en otras pantallas de creacion o edicion

### Riesgo tecnico

En un sistema con roles y pantallas administrativas, la autorizacion debe cerrarse en el servidor en el punto mas temprano posible. Usar un gate visual en cliente sirve para UX condicional, pero no debe considerarse el mecanismo primario de proteccion.

### Recomendacion

- Hacer la validacion de rol en la pagina servidor, antes de cargar datos sensibles
- Reutilizar un helper tipo `requireRole()` o una variante orientada a paginas
- Reservar `RoleGate` para esconder elementos de interfaz, no para proteger rutas

### Prioridad

Alta. El problema afecta la integridad del modelo de autorizacion.

## Hallazgo 4

### Titulo

`[P2]` Resolucion de rol duplicada y con cast inseguro

### Ubicacion principal

- `src/components/layout/app-shell.tsx:10`

### Otras ubicaciones relacionadas

- `src/app/(dashboard)/page.tsx`
- `src/features/auth/lib/require-role.ts`
- `src/hooks/use-user.ts`
- varias paginas del dashboard con `getCurrentRole()`

### Descripcion

La aplicacion repite el mismo flujo varias veces:

1. obtener usuario desde Supabase
2. consultar `profiles`
3. extraer `role`
4. forzar el tipo con `as Role`

Ese patron aparece en layout, shell, paginas del dashboard, hooks cliente y acciones de autorizacion. El problema no es solo la repeticion; tambien hay divergencias reales:

- en algunos puntos, si no hay perfil, el rol cae en `operativo`
- en otros, cae en `null`
- en otros, se lanza error

Adicionalmente, el type casting `as Role` evita validar si el valor realmente pertenece al conjunto de roles soportados.

### Impacto

- Aumenta el riesgo de errores por comportamiento inconsistente
- Duplica consultas a auth y perfil en el mismo request o flujo
- Hace mas dificil cambiar el modelo de roles
- Oculta errores de datos mediante casts en lugar de validacion real

### Riesgo tecnico

Este es un problema de arquitectura transversal. Aunque no siempre rompe la app de inmediato, erosiona la confiabilidad porque cada nuevo feature puede implementar una variante distinta del mismo concepto.

### Recomendacion

- Crear una unica utilidad de dominio para resolver usuario y rol actual
- Validar el rol con una fuente tipada real en lugar de `as Role`
- Definir una politica unica para estos casos:
  - usuario no autenticado
  - perfil inexistente
  - rol invalido o inesperado
- Reutilizar esa utilidad en layout, hooks, paginas y server actions

### Prioridad

Media-Alta. No es el bug mas visible, pero es una de las causas raiz de la inconsistencia actual.

## Hallazgo 5

### Titulo

`[P2]` La navegacion movil ya se desalineo de la navegacion principal

### Ubicacion

- `src/components/layout/mobile-nav.tsx:12`
- comparar con `src/components/layout/sidebar.tsx:29`

### Descripcion

La app mantiene dos definiciones manuales e independientes de `NAV_ITEMS`:

- una para desktop en `Sidebar`
- otra para mobile en `MobileNav`

Ambas ya no estan sincronizadas. La version movil omite rutas que si existen en desktop, entre ellas:

- `Mi Agenda`
- `Horas`
- `Disponibilidad`
- `Empresas`
- `Reportes`
- `Auditoria`

Ademas, `MobileNav` usa casts innecesarios como `as Role[]`, lo que sugiere que el tipado se esta forzando en lugar de derivarse de una estructura comun bien definida.

### Impacto

- La experiencia de usuario cambia segun dispositivo
- Se ocultan funcionalidades en mobile sin una razon funcional explicita
- Aumenta la probabilidad de nuevas divergencias con cada cambio futuro
- El mantenimiento de permisos por rol queda duplicado

### Riesgo tecnico

Este hallazgo ya se convirtio en regresion funcional. Cuando la navegacion no tiene una unica fuente de verdad, cualquier ajuste de roles o rutas genera inconsistencias de manera predecible.

### Recomendacion

- Extraer `NAV_ITEMS` a un modulo compartido y tipado
- Reutilizar la misma definicion en sidebar y mobile nav
- Derivar permisos, etiquetas e iconos desde una unica estructura
- Eliminar los casts `as Role[]`

### Prioridad

Media-Alta. Ya impacta funcionalidad y consistencia de producto.

## Causas Raiz Comunes

Los cinco hallazgos apuntan a un mismo problema de base: falta de centralizacion en conceptos transversales.

Las areas con mayor necesidad de consolidacion son:

- resolucion de usuario y rol actual
- enforcement de autorizacion
- definicion de rutas y defaults por rol
- definicion de items de navegacion
- separacion de responsabilidades entre componentes de UI y logica de acceso

## Recomendaciones Globales

### 1. Centralizar auth y rol

Crear una utilidad unica para:

- obtener el usuario actual
- obtener el perfil actual
- validar el rol
- definir fallback o error consistente

### 2. Cerrar autorizacion en servidor

Usar validacion de rol del lado servidor en paginas y acciones. Los componentes cliente deben complementar UX, no reemplazar enforcement.

### 3. Unificar rutas y navegacion

Mantener una sola fuente de verdad para:

- rutas por rol
- destino post-login
- breadcrumbs
- items de navegacion

### 4. Eliminar type casts innecesarios

Reemplazar `as Role` y `as Role[]` por:

- estructuras tipadas compartidas
- validacion explicita
- helpers reutilizables

### 5. Alinear la disciplina de lint con el codigo real

Resolver errores reales del codigo productivo y, por separado, ajustar exclusiones si carpetas auxiliares como `.claude/` o `coverage/` no deben formar parte de la verificacion principal.

## Conclusiones

La aplicacion no esta en mal estado general, pero tampoco esta en un punto donde convenga seguir agregando funcionalidades sin antes ordenar estos aspectos base. El mayor riesgo no esta en el dominio de negocio, sino en la infraestructura interna de roles, rutas y navegacion.

Si estos puntos no se corrigen pronto, el costo de mantenimiento va a crecer en tres frentes:

- mas regresiones por inconsistencias entre desktop y mobile
- mas errores por enforcement parcial de permisos
- mas friccion para cambiar roles, rutas o dashboards

La prioridad recomendada de correccion es:

1. corregir redirect post-login
2. mover el control de acceso sensible a servidor
3. centralizar resolucion de rol
4. unificar navegacion
5. sanear `NotificationBell` y cerrar errores de lint del codigo productivo
