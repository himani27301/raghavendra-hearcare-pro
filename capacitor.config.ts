import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.raghavendra.hearcare',
  appName: 'Raghavendra HearCare',
  webDir: 'patient-app',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor'
  }
};

export default config;
