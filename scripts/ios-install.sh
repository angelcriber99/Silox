#!/usr/bin/env bash
# Instala/actualiza la app iOS nativa de Silox desde este repositorio.
#
# Flujo recomendado:
#   1. Cambios web → push a GitHub → Vercel despliega automáticamente
#   2. Abre la app en el iPhone: ya verás los cambios (no hace falta reinstalar)
#
# Solo necesitas ejecutar este script cuando:
#   - Instalas por primera vez en un dispositivo
#   - Cambias plugins Capacitor, capacitor.config.ts o archivos nativos iOS
#   - Haces git pull y hay cambios en la carpeta ios/
#
# Uso: npm run ios:install

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Instalando dependencias npm..."
npm install

echo "→ Sincronizando proyecto iOS con Capacitor..."
npx cap sync ios

echo ""
echo "✓ Proyecto iOS listo."
echo ""
echo "  La app carga la web desde: https://silox-chi.vercel.app"
echo "  (los cambios web se actualizan solos al desplegar en Vercel)"
echo ""
echo "  Siguiente paso:"
echo "    1. npm run ios:open          # abre Xcode"
echo "    2. Conecta tu iPhone"
echo "    3. Selecciona tu dispositivo y pulsa Run (▶)"
echo ""
echo "  Desarrollo local contra tu Mac:"
echo "    CAPACITOR_SERVER_URL=http://TU_IP:3000 npm run ios:sync"
echo "    (usa la IP de tu Mac, no localhost, en dispositivo físico)"
