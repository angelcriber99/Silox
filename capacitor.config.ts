import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Remote URL mode: la app nativa es un contenedor que carga la web desplegada.
 * Al hacer push a GitHub → Vercel despliega → la app iOS muestra los cambios
 * sin reinstalar (solo hace falta recompilar si cambia config nativa o plugins).
 *
 * Para desarrollo local en el simulador/dispositivo:
 *   CAPACITOR_SERVER_URL=http://TU_IP_LOCAL:3000 npm run ios:sync
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
    contentInset: 'automatic',
    scheme: 'Silox',
  },
};

export default config;
