import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.raghavendra.hearcare',
  appName: 'Raghavendra HearCare',
  webDir: 'web/out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
