import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gabrielpt.finapp',
  appName: 'FinApp',
  webDir: 'dist',
  server: {
    url: 'https://finapp-brown.vercel.app/',
    cleartext: false
  }
};

export default config;
