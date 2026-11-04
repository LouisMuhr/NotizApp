import Link from 'next/link';

// Eigenständige, helle, scrollbare Seite — unabhängig vom dunklen Graph-Layout
// (das RootLayout setzt overflow-hidden für die Vollbild-Graph-Ansicht).
const page: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: 16,
  lineHeight: 1.7,
  color: '#1a1a1a',
  background: '#fff',
  height: '100dvh',
  overflowY: 'auto',
};
const container: React.CSSProperties = { maxWidth: 680, margin: '0 auto', padding: '48px 24px 96px' };
const h1: React.CSSProperties = { fontSize: '2rem', fontWeight: 700, marginBottom: 8 };
const meta: React.CSSProperties = { color: '#666', fontSize: '0.9rem', marginBottom: 48 };
const hr: React.CSSProperties = { border: 'none', borderTop: '1px solid #e5e5e5', margin: '48px 0' };
const footer: React.CSSProperties = { color: '#666', fontSize: '0.85rem', display: 'flex', gap: 16, flexWrap: 'wrap' };

export const legal = {
  h2: { fontSize: '1.1rem', fontWeight: 600, margin: '36px 0 8px' } as React.CSSProperties,
  h3: { fontSize: '1rem', fontWeight: 600, margin: '20px 0 4px' } as React.CSSProperties,
  p: { marginBottom: 12 } as React.CSSProperties,
  ul: { paddingLeft: 20, marginBottom: 12 } as React.CSSProperties,
  li: { marginBottom: 6 } as React.CSSProperties,
  a: { color: '#1a1a1a' } as React.CSSProperties,
};

export default function LegalPage({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <main style={page}>
      <div style={container}>
        <h1 style={h1}>{title}</h1>
        {updated ? <p style={meta}>Zuletzt aktualisiert: {updated}</p> : <div style={{ marginBottom: 32 }} />}
        {children}
        <hr style={hr} />
        <p style={footer}>
          <Link style={legal.a} href="/">Velm</Link>
          <Link style={legal.a} href="/impressum">Impressum</Link>
          <Link style={legal.a} href="/privacy">Datenschutz</Link>
        </p>
      </div>
    </main>
  );
}
