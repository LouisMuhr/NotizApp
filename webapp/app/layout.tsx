import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NotizApp — Second Brain',
  description: 'Knowledge Graph für deine Threads und Notizen',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full">
      <body className="h-full overflow-hidden bg-[#0F1117]">{children}</body>
    </html>
  );
}
