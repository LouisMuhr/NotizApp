import type { Metadata } from 'next';
import { Inter, Lora, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { LocaleProvider } from '@/lib/i18n';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  style: ['normal', 'italic'],
  display: 'swap',
});

// Serif der App (Überschriften); im Graphen für die Insel-Namen.
const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Velm — Second Brain',
  description: 'Knowledge graph for your threads and notes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`h-full ${inter.variable} ${lora.variable} ${instrument.variable}`}>
      <body className="h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
