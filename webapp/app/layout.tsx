import type { Metadata } from 'next';
import { Inter, Lora } from 'next/font/google';
import './globals.css';

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

export const metadata: Metadata = {
  title: 'Notiz — Second Brain',
  description: 'Knowledge Graph für deine Threads und Notizen',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`h-full ${inter.variable} ${lora.variable}`}>
      <body className="h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
        {children}
      </body>
    </html>
  );
}
