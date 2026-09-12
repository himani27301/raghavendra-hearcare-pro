import './globals.css';

export const metadata = {
  title: 'HearCare Pro | Raghavendra Speech and Hearing Center',
  description: 'Clinic management and patient portal for Raghavendra Speech and Hearing Center, Hyderabad',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/hearcare-icon.svg',
    apple: '/hearcare-icon.svg'
  },
  applicationName: 'Raghavendra HearCare Pro'
};

export const viewport = {
  themeColor: '#123f68',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }) {
  return (<html lang="en"><body>{children}</body></html>);
}
