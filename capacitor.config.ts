import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.angelcriber.silox',
  appName: 'Silox',
  webDir: 'public',
  server: {
    url: 'https://silox-chi.vercel.app',
    cleartext: true
  }
};

export default config;
