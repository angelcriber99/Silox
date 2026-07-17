# Silox para iPhone

Cliente SwiftUI nativo, iPhone-only e iOS 18+. El proyecto Xcode se genera de forma reproducible:

```sh
cd ios/App
xcodegen generate
open App.xcodeproj
```

## Configuración

Los endpoints se inyectan con `Config/*.xcconfig`. `Debug` y `Release` apuntan al dominio público de Silox y al mismo proyecto Supabase que la web para que un iPhone conectado pueda ejecutar el flujo real; `Staging` requiere configuración de CI o local. El bundle solo contiene la clave publicable. Nunca se debe incluir la service-role key.

- La sesión de usuario se almacena en Keychain.
- Google usa `ASWebAuthenticationSession`, callback nativo y PKCE; correo y contraseña usan Supabase Auth directamente.
- El token del widget es de solo lectura y se comparte mediante Keychain Sharing.
- App Group contiene únicamente el último JSON de resumen para uso offline.

La app espera la API JSON versionada bajo `/api/mobile/v1`. Las escrituras financieras usan `Idempotency-Key` y no se encolan offline. La cartera consulta la misma canalización de Yahoo Finance/currency API que la web cada cinco segundos mientras la app está activa.

## Preparación del backend

Antes de distribuir un build hay que desplegar el mismo commit de Next.js y aplicar, en orden, estas migraciones:

- `20260717120000_mobile_api_idempotency.sql`
- `20260717143000_secure_widget_access_tokens.sql`
- `20260717150000_notification_preferences.sql`

Sin ellas se bloquean deliberadamente las escrituras idempotentes, el widget seguro y las preferencias remotas.

## Validación local

```sh
cd ios/App
xcodegen generate
xcodebuild -project App.xcodeproj -scheme Silox \
  -destination 'platform=iOS Simulator,name=iPhone 16e' \
  CODE_SIGNING_ALLOWED=NO test
xcodebuild -project App.xcodeproj -scheme Silox -configuration Release \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Para un archive de dispositivo hay que seleccionar el Team propietario de los identificadores `com.angelcriber.silox`, su App Group y su Keychain Sharing en Xcode/CI.
