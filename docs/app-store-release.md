# Preparación para App Store

## Implementado

- Proyecto Xcode reproducible con XcodeGen y configuraciones separadas.
- Sesión en Keychain, PKCE para OAuth y widget con credencial de solo lectura.
- Escrituras financieras idempotentes y lecturas con caché, reintentos acotados y pausa en segundo plano.
- Cadencia indicada por el servidor: 5 segundos en sesión activa y 30 segundos con mercados cerrados.
- Manifiesto de privacidad para correo, identificador e información financiera, sin tracking.
- Política de privacidad, términos y eliminación completa de cuenta accesibles dentro de la app.
- CI macOS que regenera el proyecto, valida manifiestos, compila app y tests y analiza Release.

## Obligatorio antes de enviar a revisión

1. Completar en App Store Connect las mismas declaraciones del manifiesto de privacidad.
2. Publicar una URL de soporte estable y revisar con asesoramiento jurídico la política y los términos.
3. Confirmar la entidad legal y los permisos aplicables a una aplicación de seguimiento financiero.
4. Proporcionar a App Review una cuenta de demostración, instrucciones y datos de muestra.
5. Preparar capturas, descripción, clasificación por edad y export compliance.
6. Ejecutar tests en dispositivos reales, TestFlight interno y posteriormente TestFlight externo.
7. Archivar con distribución App Store, validar el archive y comprobar símbolos de depuración.

La compilación correcta es necesaria, pero no sustituye la revisión legal ni la configuración de privacidad de App Store Connect.
