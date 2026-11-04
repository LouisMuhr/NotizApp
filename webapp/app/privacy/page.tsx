import type { Metadata } from 'next';
import LegalPage, { legal } from '@/components/LegalPage';
import { OPERATOR, PRIVACY_UPDATED } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung – Velm',
  description: 'Welche Daten Velm verarbeitet, wofür, bei wem und welche Rechte du hast.',
};

const { h2, h3, p, ul, li, a } = legal;

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return <a style={a} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

// Einzige Fassung der Datenschutzerklärung — App (`app.json` → privacyPolicyUrl, Einstellungen)
// und Stores verlinken hierher. Inhalt muss zu docs/audit/dsgvo-2026-11-04.md passen.
export default function PrivacyPage() {
  return (
    <LegalPage lang="de" kind="privacy" title="Datenschutzerklärung" updated={PRIVACY_UPDATED.de}>
      <p style={p}>
        Diese Erklärung gilt für die App Velm (Android, iOS) und die Web-App unter www.velmnote.com.
        Sie beschreibt, welche personenbezogenen Daten wir verarbeiten, wofür, auf welcher
        Rechtsgrundlage, an wen sie gehen und welche Rechte du hast.
      </p>

      <h2 style={h2}>1. Verantwortlicher</h2>
      <p style={p}>
        {OPERATOR.name} ({OPERATOR.business.de})<br />
        {OPERATOR.street}, {OPERATOR.city}, {OPERATOR.country.de}<br />
        E-Mail: <a style={a} href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
      </p>
      <p style={p}>Einen Datenschutzbeauftragten müssen wir nicht benennen.</p>

      <h2 style={h2}>2. Grundsatz: lokal zuerst</h2>
      <p style={p}>
        Ohne Konto bleiben deine Notizen ausschließlich auf deinem Gerät. Erst wenn du ein Konto
        anlegst und deine E-Mail-Adresse bestätigst, werden Notizen und Threads mit unserem Server
        synchronisiert. Wir nutzen keine Werbung, kein Tracking, keine Analyse-Tools und kein
        Crash-Reporting.
      </p>

      <h2 style={h2}>3. Welche Daten wir verarbeiten</h2>

      <h3 style={h3}>3.1 Nutzung ohne Konto (nur App)</h3>
      <p style={p}>
        Notizen, Kategorien, Erinnerungen, Threads und Einstellungen werden nur im Speicher deines
        Geräts abgelegt. Erinnerungen sind lokale Benachrichtigungen; es gibt keinen Push-Server.
        Wir erhalten davon nichts.
      </p>

      <h3 style={h3}>3.2 Konto und Synchronisation</h3>
      <ul style={ul}>
        <li style={li}><strong>Kontodaten:</strong> E-Mail-Adresse, Passwort (nur als Hash gespeichert), Sprache, Zeitpunkte von Registrierung, Bestätigung und letzter Anmeldung; in der Web-App optional ein Anzeigename.</li>
        <li style={li}><strong>Inhalte:</strong> Notizen (Titel, Text, Checklisten, Kategorie, Erinnerungszeitpunkt, Herkunft wie App/Diktat/Teilen/Bookmarklet, Archiv-Status), Threads, Zusammenfassungen und Verbindungen.</li>
        <li style={li}><strong>Nutzungsdaten für Limits:</strong> Abo-Stufe sowie Zeitpunkt und Anzahl der KI-Läufe pro Tag.</li>
      </ul>
      <p style={p}>
        Zweck: Konto bereitstellen, Notizen geräteübergreifend synchronisieren, Web-App anzeigen.
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertrag). Bestätigungs- und Wiederherstellungscodes
        senden wir per E-Mail über unseren Auth-Dienst und den Versanddienst Resend (siehe Abschnitt 5).
      </p>

      <h3 style={h3}>3.3 KI-Funktionen</h3>
      <p style={p}>
        KI wird nur tätig, wenn du sie ausdrücklich auslöst:
      </p>
      <ul style={ul}>
        <li style={li}><strong>Synthese</strong> (Threads bilden): Titel und Text deiner Notizen, die noch keinem Thread zugeordnet sind, sowie Titel und Zusammenfassungen bestehender Threads.</li>
        <li style={li}><strong>KI-Sprachnotizen</strong> (Pro): der diktierte Text, um daraus Titel, Inhalt, Checkliste und Erinnerung zu erkennen.</li>
      </ul>
      <p style={p}>
        Diese Texte gehen an Anthropic (Claude, siehe Abschnitt 5). Anthropic nutzt sie nicht zum
        Training und löscht sie nach eigenen Angaben spätestens nach 30 Tagen. Es findet keine
        automatisierte Entscheidung mit rechtlicher Wirkung im Sinne von Art. 22 DSGVO statt.
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
      </p>
      <p style={p}>
        Notizen können sensible Inhalte enthalten (z. B. zu Gesundheit). Wenn du solche Notizen in
        eine KI-Funktion gibst, geschieht das auf deine ausdrückliche Veranlassung
        (Art. 9 Abs. 2 lit. a DSGVO). Möchtest du das nicht, lass betroffene Notizen aus Threads heraus
        oder nutze die KI-Funktionen nicht.
      </p>

      <h3 style={h3}>3.4 Diktat und Mikrofon (App)</h3>
      <p style={p}>
        Für Sprachnotizen nutzt die App die Spracherkennung deines Betriebssystems. Mit
        Internetverbindung wird das Audio dabei von Google (Android) bzw. Apple (iOS) verarbeitet,
        ohne Verbindung auf dem Gerät. Wir selbst erhalten und speichern kein Audio, nur den erkannten
        Text. Für die Spracherkennung gelten die Datenschutzbestimmungen von{' '}
        <Ext href="https://policies.google.com/privacy">Google</Ext> bzw.{' '}
        <Ext href="https://www.apple.com/legal/privacy/">Apple</Ext>. Den Mikrofonzugriff erteilst und
        entziehst du in den Systemeinstellungen.
      </p>

      <h3 style={h3}>3.5 Teilen und Bookmarklet</h3>
      <p style={p}>
        Teilst du Text aus einer anderen App mit Velm, wird er als Notiz angelegt. Das Bookmarklet
        (Web) übernimmt den markierten Text, den Seitentitel und die Adresse der Seite, auf der du es
        auslöst, und speichert sie als Notiz in deinem Konto. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <h3 style={h3}>3.6 Bezahlte Abos</h3>
      <p style={p}>
        Schließt du ein kostenpflichtiges Abo ab, wickelt Stripe die Zahlung ab. Zahlungsdaten
        (z. B. Kartennummer) gibst du direkt bei Stripe ein; wir erhalten nur Abo-Status, Betrag,
        Datum und eine Kunden-Kennung. Rechtsgrundlagen: Art. 6 Abs. 1 lit. b DSGVO (Vertrag) und
        lit. c (steuer- und handelsrechtliche Aufbewahrungspflichten).
      </p>

      <h3 style={h3}>3.7 Technische Daten beim Aufruf</h3>
      <p style={p}>
        Beim Aufruf der Web-App und unserer Server-Schnittstellen verarbeitet unser Hoster
        technisch notwendige Daten (IP-Adresse, Zeitpunkt, aufgerufene Adresse, Browser-Kennung) in
        Server-Logs, um den Dienst auszuliefern und Missbrauch abzuwehren. Die App prüft vor dem Diktat
        mit einer kurzen Anfrage an www.velmnote.com, ob eine Internetverbindung besteht. Die App fragt
        außerdem beim Start bei Expo nach App-Updates; dabei werden IP-Adresse, App-Version und
        Plattform übertragen. Die Logs werden nach kurzer Zeit automatisch gelöscht. Rechtsgrundlage:
        Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren, funktionierenden Dienst).
      </p>

      <h3 style={h3}>3.8 Speicher im Browser</h3>
      <p style={p}>
        Die Web-App speichert im Browser (localStorage/sessionStorage) nur, was für den Dienst nötig
        ist: deine Anmeldesitzung, die gewählte Sprache, ob du die Einführung schon gesehen hast, und
        einen kurzfristigen Zwischenspeicher des Graphen. Es werden keine Cookies zu Tracking- oder
        Werbezwecken gesetzt. Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TDDDG, Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <h2 style={h2}>4. Speicherort und Sicherheit</h2>
      <p style={p}>
        Unsere Datenbank (Supabase) liegt in Frankfurt am Main. Unsere Server-Funktionen (Vercel)
        laufen ebenfalls in Frankfurt. Alle Verbindungen sind TLS-verschlüsselt; jede Zeile in der
        Datenbank ist per Zugriffsregel nur für das zugehörige Konto lesbar.
      </p>

      <h2 style={h2}>5. Empfänger und Auftragsverarbeiter</h2>
      <ul style={ul}>
        <li style={li}><strong>Supabase Inc.</strong> (USA; Daten in Frankfurt) – Datenbank und Anmeldung. <Ext href="https://supabase.com/privacy">Datenschutz</Ext></li>
        <li style={li}><strong>Resend</strong> (Plus Five Five, Inc., USA) – Versand der E-Mails mit Bestätigungs- und Anmeldecodes (E-Mail-Adresse, Code, Sprache). <Ext href="https://resend.com/legal/privacy-policy">Datenschutz</Ext></li>
        <li style={li}><strong>Vercel Inc.</strong> (USA; Funktionen in Frankfurt) – Hosting der Web-App und der Server-Schnittstellen. <Ext href="https://vercel.com/legal/privacy-policy">Datenschutz</Ext></li>
        <li style={li}><strong>Anthropic PBC</strong> (USA) – KI-Verarbeitung nach Abschnitt 3.3. <Ext href="https://www.anthropic.com/legal/privacy">Datenschutz</Ext></li>
        <li style={li}><strong>650 Industries, Inc. (Expo)</strong> (USA) – Auslieferung von App-Updates. <Ext href="https://expo.dev/privacy">Datenschutz</Ext></li>
        <li style={li}><strong>Stripe</strong> (Stripe Payments Europe Ltd., Irland, und Stripe, Inc., USA) – Zahlungsabwicklung bei Abos. <Ext href="https://stripe.com/de/privacy">Datenschutz</Ext></li>
      </ul>
      <p style={p}>
        Mit diesen Dienstleistern bestehen Verträge zur Auftragsverarbeitung (Art. 28 DSGVO), soweit sie
        in unserem Auftrag tätig sind. Wir verkaufen keine Daten und geben sie nicht zu Werbezwecken weiter.
      </p>

      <h2 style={h2}>6. Übermittlung in Drittländer</h2>
      <p style={p}>
        Die genannten Anbieter mit Sitz in den USA können personenbezogene Daten in den USA verarbeiten.
        Grundlage ist der Angemessenheitsbeschluss der EU-Kommission zum EU-US Data Privacy Framework,
        soweit der Anbieter zertifiziert ist, und ansonsten die EU-Standardvertragsklauseln
        (Art. 46 Abs. 2 lit. c DSGVO), die Teil der jeweiligen Auftragsverarbeitungsverträge sind.
      </p>

      <h2 style={h2}>7. Speicherdauer</h2>
      <ul style={ul}>
        <li style={li}>Lokale Daten: bis du sie löschst oder die App deinstallierst.</li>
        <li style={li}>Konto und Inhalte: bis du dein Konto löschst. Gelöschte Notizen entfernen wir sofort vom Server.</li>
        <li style={li}>Nicht bestätigte Registrierungen: werden beim Abbruch sofort, sonst spätestens nach 30 Tagen gelöscht.</li>
        <li style={li}>KI-Eingaben bei Anthropic: höchstens 30 Tage.</li>
        <li style={li}>Server-Logs: wenige Tage.</li>
        <li style={li}>Rechnungs- und Zahlungsbelege: 8 bzw. 10 Jahre (§ 147 AO, § 257 HGB), auch nach Löschung des Kontos.</li>
      </ul>

      <h2 style={h2}>8. Deine Rechte</h2>
      <p style={p}>Du hast das Recht auf</p>
      <ul style={ul}>
        <li style={li}><strong>Auskunft</strong> (Art. 15 DSGVO),</li>
        <li style={li}><strong>Berichtigung</strong> (Art. 16) – Notizen kannst du jederzeit selbst bearbeiten,</li>
        <li style={li}><strong>Löschung</strong> (Art. 17) – direkt in der App unter Einstellungen → Datenschutz &amp; DSGVO → „Konto &amp; alle Daten löschen“; dabei werden Konto, E-Mail-Adresse und alle Inhalte lokal und auf dem Server entfernt,</li>
        <li style={li}><strong>Einschränkung der Verarbeitung</strong> (Art. 18),</li>
        <li style={li}><strong>Datenübertragbarkeit</strong> (Art. 20) – Export aller Notizen und Threads als JSON unter Einstellungen → Datenschutz &amp; DSGVO,</li>
        <li style={li}><strong>Widerspruch</strong> (Art. 21) gegen Verarbeitungen auf Grundlage berechtigter Interessen (Abschnitt 3.7),</li>
        <li style={li}><strong>Widerruf</strong> einer Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3).</li>
      </ul>
      <p style={p}>
        Anfragen an <a style={a} href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>; wir antworten
        innerhalb eines Monats. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde
        beschweren (Art. 77 DSGVO), insbesondere in dem Land, in dem du wohnst.
      </p>

      <h2 style={h2}>9. Pflicht zur Bereitstellung</h2>
      <p style={p}>
        Du bist nicht verpflichtet, uns Daten bereitzustellen. Ohne E-Mail-Adresse kannst du kein Konto
        anlegen; die App funktioniert dann lokal weiter, ohne Synchronisation, Web-App und KI-Funktionen.
      </p>

      <h2 style={h2}>10. Mindestalter</h2>
      <p style={p}>Velm richtet sich an Personen ab 16 Jahren.</p>

      <h2 style={h2}>11. Änderungen</h2>
      <p style={p}>
        Wir passen diese Erklärung an, wenn sich der Dienst oder die Rechtslage ändert. Die jeweils
        aktuelle Fassung steht auf dieser Seite; über wesentliche Änderungen informieren wir in der App.
      </p>
    </LegalPage>
  );
}
