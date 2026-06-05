import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung – Velm',
  description: 'Welche Daten Velm erfasst, wie sie verwendet werden und welche Rechte du hast.',
};

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
const container: React.CSSProperties = {
  maxWidth: 680,
  margin: '0 auto',
  padding: '48px 24px 96px',
};
const h1: React.CSSProperties = { fontSize: '2rem', fontWeight: 700, marginBottom: 8 };
const meta: React.CSSProperties = { color: '#666', fontSize: '0.9rem', marginBottom: 48 };
const h2: React.CSSProperties = { fontSize: '1.1rem', fontWeight: 600, margin: '36px 0 8px' };
const p: React.CSSProperties = { marginBottom: 12 };
const ul: React.CSSProperties = { paddingLeft: 20, marginBottom: 12 };
const li: React.CSSProperties = { marginBottom: 6 };
const a: React.CSSProperties = { color: '#1a1a1a' };
const hr: React.CSSProperties = { border: 'none', borderTop: '1px solid #e5e5e5', margin: '48px 0' };

export default function PrivacyPage() {
  return (
    <main style={page}>
      <div style={container}>
        <h1 style={h1}>Datenschutzerklärung</h1>
        <p style={meta}>Zuletzt aktualisiert: Mai 2025</p>

        <p style={p}>
          Diese Datenschutzerklärung beschreibt, welche Daten Velm erfasst, wie sie verwendet
          werden und welche Rechte du als Nutzer hast.
        </p>

        <h2 style={h2}>1. Verantwortlicher</h2>
        <p style={p}>
          Louis Muhr<br />
          E-Mail: <a style={a} href="mailto:louismuhr8@gmail.com">louismuhr8@gmail.com</a>
        </p>

        <h2 style={h2}>2. Welche Daten werden erfasst?</h2>
        <ul style={ul}>
          <li style={li}><strong>Inhalte:</strong> Notizen, Gedanken und Threads, die du in der App erstellst.</li>
          <li style={li}><strong>Konto-Daten:</strong> E-Mail-Adresse (nur wenn du dein Konto absicherst; ansonsten anonym).</li>
          <li style={li}><strong>Technische Daten:</strong> Anonyme Nutzer-ID zur Datenzuordnung (keine Tracking-IDs).</li>
        </ul>
        <p style={p}>Es werden keine Standortdaten, Kontakte oder Geräteinformationen erfasst.</p>

        <h2 style={h2}>3. Zweck der Verarbeitung</h2>
        <ul style={ul}>
          <li style={li}>Speicherung und Synchronisation deiner Notizen über mehrere Geräte</li>
          <li style={li}>KI-gestützte Synthese deiner Gedanken (nur auf explizite Anfrage)</li>
          <li style={li}>Bereitstellung des Dienstes</li>
        </ul>

        <h2 style={h2}>4. Datenspeicherung</h2>
        <p style={p}>
          Deine Daten werden in der EU auf Servern von{' '}
          <a style={a} href="https://supabase.com/privacy" target="_blank" rel="noopener">Supabase</a> gespeichert.
          Supabase ist nach DSGVO-konformen Standardvertragsklauseln zertifiziert.
        </p>
        <p style={p}>
          KI-Synthesen werden über die{' '}
          <a style={a} href="https://www.anthropic.com/privacy" target="_blank" rel="noopener">Anthropic API</a> verarbeitet.
          Deine Inhalte werden nicht für das Training von KI-Modellen verwendet.
        </p>

        <h2 style={h2}>5. Datenweitergabe</h2>
        <p style={p}>
          Deine Daten werden nicht an Dritte verkauft oder zu Werbezwecken weitergegeben.
          Eine Weitergabe erfolgt ausschließlich an die unter Punkt 4 genannten Dienstleister
          zur Erbringung des Dienstes.
        </p>

        <h2 style={h2}>6. Speicherdauer</h2>
        <p style={p}>
          Deine Daten werden gespeichert, solange dein Konto aktiv ist. Du kannst deine Daten
          jederzeit vollständig löschen (siehe Punkt 7).
        </p>

        <h2 style={h2}>7. Deine Rechte</h2>
        <p style={p}>Du hast das Recht auf:</p>
        <ul style={ul}>
          <li style={li}><strong>Auskunft</strong> über deine gespeicherten Daten</li>
          <li style={li}><strong>Berichtigung</strong> falscher Daten</li>
          <li style={li}><strong>Löschung</strong> aller deiner Daten — direkt in der App unter Einstellungen → Daten → App-Daten zurücksetzen</li>
          <li style={li}><strong>Datenportabilität</strong> — Export aller Notizen als JSON über Einstellungen → Daten → Alle Notizen exportieren</li>
          <li style={li}><strong>Widerspruch</strong> gegen die Verarbeitung</li>
        </ul>
        <p style={p}>
          Für Anfragen zu deinen Rechten wende dich an:{' '}
          <a style={a} href="mailto:louismuhr8@gmail.com">louismuhr8@gmail.com</a>
        </p>

        <h2 style={h2}>8. Anonyme Nutzung</h2>
        <p style={p}>
          Velm erstellt beim ersten Start automatisch ein anonymes Konto — kein Login erforderlich.
          Wenn du dein Gerät wechselst oder die App deinstallierst, ohne dein Konto zu sichern,
          gehen deine Daten verloren. Du kannst dein Konto jederzeit unter Einstellungen → Konto absichern.
        </p>

        <h2 style={h2}>9. Minderjährige</h2>
        <p style={p}>
          Velm richtet sich nicht an Kinder unter 16 Jahren. Wir erfassen wissentlich keine
          Daten von Minderjährigen.
        </p>

        <h2 style={h2}>10. Änderungen dieser Erklärung</h2>
        <p style={p}>
          Änderungen werden auf dieser Seite veröffentlicht. Bei wesentlichen Änderungen
          informieren wir dich in der App.
        </p>

        <hr style={hr} />

        <p style={{ color: '#666', fontSize: '0.85rem' }}>
          Velm · <a style={a} href="mailto:louismuhr8@gmail.com">louismuhr8@gmail.com</a>
        </p>
      </div>
    </main>
  );
}
