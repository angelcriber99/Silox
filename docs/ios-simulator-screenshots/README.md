# Validación de Silox en el simulador de iPhone

Evidencias capturadas el 17 de julio de 2026 en un iPhone 17 Pro con iOS 26.0. La aplicación inició sesión contra Supabase, leyó la cartera y los movimientos reales de una cuenta de prueba aislada, consultó las cotizaciones mediante el mismo backend de Silox y creó MSFT desde la interfaz nativa.

La compra de prueba de MSFT se insertó mediante la función transaccional existente de Supabase para validar la lectura posterior. El endpoint móvil de escritura mantiene el bloqueo seguro hasta desplegar en producción la migración de idempotencia incluida en el proyecto.

- [Detalle de AAPL y cotización en directo](02-aapl-live-detail.png)
- [Formulario para añadir un movimiento](03-add-movement.png)
- [Creación nativa de un activo](04-new-asset.png)
- [MSFT creado y seleccionado](05-msft-created.png)
- [Cartera sincronizada con AAPL y MSFT](06-portfolio-aapl-msft.png)
- [Movimientos sincronizados desde Supabase](07-transactions-aapl-msft.png)
