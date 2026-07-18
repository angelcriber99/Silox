#!/usr/bin/env bash
# Instala/actualiza la app iOS nativa de Silox desde este repositorio.
#
# Genera y abre el proyecto SwiftUI. Cada cambio nativo requiere un build nuevo
# desde Xcode o una nueva distribución por TestFlight/App Store.
#
# Uso: npm run ios:install

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Este flujo requiere macOS con Xcode y XcodeGen." >&2
  exit 1
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "Falta XcodeGen. Instálalo con: brew install xcodegen" >&2
  exit 1
fi

echo "→ Generando el proyecto SwiftUI..."
(cd ios/App && xcodegen generate)

echo ""
echo "✓ Proyecto iOS nativo listo."
echo ""
echo "  Siguiente paso:"
echo "    1. npm run ios:open"
echo "    2. Conecta tu iPhone"
echo "    3. Selecciona tu dispositivo y pulsa Run (▶)"
open ios/App/App.xcodeproj
