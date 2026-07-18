import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuración heredada del antiguo contenedor Capacitor.
 * La app distribuible actual vive en ios/App y es SwiftUI nativa; este archivo
 * no debe utilizarse para generar, abrir ni publicar el target Silox.
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL ?? 'https://silox-chi.vercel.app';

const config: CapacitorConfig = {
  appId: 'com.angelcriber.silox',
  appName: 'Silox',
  webDir: 'public',
  backgroundColor: '#000000',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
  },
  ios: {
    contentInset: 'always',
    scheme: 'Silox',
  },
};

export default config;
