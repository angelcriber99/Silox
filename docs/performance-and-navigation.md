# Estrategia de rendimiento, precarga y navegación

## Objetivo

Silox debe pintar información útil desde caché en el primer frame, quedar interactiva sin esperar a la red y actualizar los datos en segundo plano. Cambiar de pestaña no debe iniciar una carga que bloquee la interfaz.

El patrón aplicado es **stale-while-revalidate**:

1. Mostrar inmediatamente el último valor válido de memoria o disco.
2. Consultar la red solo cuando el TTL haya vencido.
3. Mantener el contenido anterior mientras llega la respuesta.
4. Sustituirlo de forma atómica cuando la respuesta sea válida.
5. Conservar el último dato bueno si la red falla e indicar que puede estar desactualizado.

## Orden de precarga

### Fase 0: arranque y primer frame

- Restaurar sesión y preferencias locales.
- Leer snapshots desde memoria/disco; no esperar a la red.
- Renderizar el shell, la navegación y la última cartera conocida.

### Fase 1: prioridad de usuario

Se inicia al entrar en el área autenticada, sin bloquear la interfaz:

- Posiciones, aportación neta y órdenes pendientes.
- Precios de los tickers activos mediante el refresco en tiempo real existente.
- Catálogo de activos necesario para «Añadir movimiento».

### Fase 2: navegador o dispositivo inactivo

Después del primer render se precargan en paralelo:

- Movimientos.
- Radar y eventos.
- Histórico de cartera.
- Alertas.
- Preferencias remotas.
- Rutas y módulos de Análisis.

No se precargan gráficos o noticias de cada activo individual: dependen de una intención concreta y dispararían demasiadas consultas. Sí se precarga el detalle al navegar mediante el prefetch de rutas de Next.js.

## Política de caché

| Dato | TTL | Actualización adicional | Motivo |
| --- | ---: | --- | --- |
| Cartera/posiciones | 15–60 s según cliente | Realtime y refresco de precios | Dato crítico y cambiante |
| Precios | 3–30 s configurable | foco, reconexión e intervalo | Sensible al mercado y batería |
| Movimientos | 60 s | invalidación al crear/editar/borrar | Cambia por acción del usuario |
| Activos | 10 min | invalidación al crear/editar | Catálogo casi estable |
| Radar | 5 min | invalidación de eventos | Eventos de baja frecuencia |
| Histórico | 5 min | snapshots periódicos | No necesita polling agresivo |
| Alertas | 2 min | invalidación tras mutación | Frecuencia media |
| Preferencias | 15 min | actualización optimista al guardar | Muy estable |

La caché financiera se elimina al cerrar sesión tanto en nativo como en web. Las mutaciones expulsan las claves afectadas antes de notificar a las vistas. Las peticiones concurrentes de una misma fuente pasan por `SingleFlight`: precarga, pull-to-refresh y apertura de pestaña comparten una sola petición.

## Implementación por plataforma

### iOS nativo

- `ReadCache` mantiene una capa rápida en memoria y una copia JSON atómica en `Caches`.
- Cada repositorio conoce su TTL y expone `value(maxAge:)` para decidir entre caché o red.
- `AppDataPreloader` calienta primero cartera/activos y después movimientos, Radar, histórico, alertas y ajustes con prioridad `utility`.
- SwiftUI mantiene cada `StateObject` de las cinco pestañas. Al abrir una pestaña, su modelo recibe datos ya calientes y revalida sin borrar el contenido.
- Las consultas solapadas se deduplican con `SingleFlight`.
- Al volver a primer plano se ejecuta la misma preparación, respetando TTL y pausando el refresco continuo cuando la app queda inactiva.

### Web de escritorio

- React Query vive en el layout raíz autenticado, conserva entradas inactivas durante 30 minutos y revalida al recuperar foco o conexión.
- Se eliminó el `template.tsx` del segmento principal porque Next.js remonta los templates en cada navegación; el layout persistente conserva ahora caché, shell y estado visual.
- `AppDataPreloader` usa `prefetchQuery`, `router.prefetch` y `requestIdleCallback` para separar lo imprescindible del trabajo secundario.
- Existe un solo canal Supabase Realtime en el shell. Antes, cada uso de `usePortfolio` podía abrir otra suscripción y repetir invalidaciones.

### Web móvil / instalación PWA-Capacitor

- Comparte exactamente QueryClient, precarga e invalidaciones con escritorio.
- La barra inferior permanece montada durante la navegación.
- El formulario rápido usa posiciones y activos ya precargados.
- Los precios mantienen el último valor válido en almacenamiento local si una fuente falla, marcándolo como retrasado; nunca se presenta como una cotización nueva.

## Navegación nativa

La barra inferior contiene cinco destinos persistentes:

```text
┌─────────┬──────────┬────────┬───────┬─────────┐
│ Cartera │ Análisis │  Mov.  │ Radar │ Ajustes │
└─────────┴──────────┴────────┴───────┴─────────┘
```

- **Cartera:** valor, sesión completa y posiciones activas.
- **Análisis:** patrimonio, P&L diario/total, evolución, concentración y principales movimientos.
- **Movimientos:** historial y filtros.
- **Radar:** calendario, noticias y catalizadores de posiciones activas.
- **Ajustes:** experiencia, notificaciones, privacidad, widget y cuenta.
- **Añadir:** acción contextual en la barra superior de Cartera, Análisis y Movimientos, siempre cerca del dato sobre el que actúa y sin ocupar un sexto hueco inferior.

## Comportamiento ante errores

- Un error de red no sustituye un dato válido por un estado vacío.
- Los fallos de precarga son independientes (`allSettled`/`try?`): Radar no puede impedir que aparezca Cartera.
- Reintentar o hacer pull-to-refresh fuerza una revalidación.
- Las mutaciones invalidan todos los derivados contables relacionados para impedir que posición, movimientos y aportación neta diverjan.

## Verificación recomendada en dispositivo

1. Abrir con red, recorrer todas las pestañas y confirmar que no aparece un loader de pantalla completa.
2. Cerrar y abrir en modo avión: debe mostrarse la última caché nativa con aviso de antigüedad.
3. Crear un movimiento y comprobar actualización de Cartera y Movimientos sin reiniciar.
4. Pasar a segundo plano, esperar más de 15 segundos y volver: debe revalidar sin vaciar la pantalla.
5. En web, inspeccionar Supabase y confirmar un único canal del shell por pestaña del navegador.
6. Medir Time to Interactive, tiempo de cambio de pestaña y número de peticiones duplicadas antes/después.
