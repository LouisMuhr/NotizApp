import type { Metadata } from 'next';
import LegalPage, { legal } from '@/components/LegalPage';
import { OPERATOR, PRIVACY_UPDATED } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy – Velm',
  description: 'What data Velm processes, why, with whom, and what rights you have.',
};

const { h2, h3, p, ul, li, a } = legal;

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return <a style={a} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

// English counterpart of app/privacy/page.tsx — keep both in sync, section by section.
export default function PrivacyPageEn() {
  return (
    <LegalPage lang="en" kind="privacy" title="Privacy Policy" updated={PRIVACY_UPDATED.en}>
      <p style={p}>
        This policy applies to the Velm app (Android, iOS) and the web app at www.velmnote.com. It
        describes which personal data we process, for what purpose, on which legal basis, who receives
        it and what rights you have. In case of doubt, the German version prevails.
      </p>

      <h2 style={h2}>1. Controller</h2>
      <p style={p}>
        {OPERATOR.name} ({OPERATOR.business.en})<br />
        {OPERATOR.street}, {OPERATOR.city}, {OPERATOR.country.en}<br />
        Email: <a style={a} href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
      </p>
      <p style={p}>We are not required to appoint a data protection officer.</p>

      <h2 style={h2}>2. Principle: local first</h2>
      <p style={p}>
        Without an account, your notes stay on your device only. Notes and threads are synced with our
        server only after you create an account and confirm your email address. We use no advertising,
        no tracking, no analytics tools and no crash reporting.
      </p>

      <h2 style={h2}>3. What data we process</h2>

      <h3 style={h3}>3.1 Use without an account (app only)</h3>
      <p style={p}>
        Notes, categories, reminders, threads and settings are stored only on your device. Reminders are
        local notifications; there is no push server. We receive none of this.
      </p>

      <h3 style={h3}>3.2 Account and sync</h3>
      <ul style={ul}>
        <li style={li}><strong>Account data:</strong> email address, password (stored only as a hash), language, timestamps of registration, confirmation and last sign-in; optionally a display name in the web app.</li>
        <li style={li}><strong>Content:</strong> notes (title, text, checklists, category, reminder time, origin such as app/dictation/share/bookmarklet, archive status), threads, summaries and connections.</li>
        <li style={li}><strong>Usage data for limits:</strong> plan tier and the time and number of AI runs per day.</li>
      </ul>
      <p style={p}>
        Purpose: provide the account, sync notes across devices, display the web app. Legal basis:
        Art. 6(1)(b) GDPR (contract). We send confirmation and recovery codes by email via our auth
        service and the email delivery service Resend (see section 5).
      </p>

      <h3 style={h3}>3.3 AI features</h3>
      <p style={p}>AI only acts when you explicitly trigger it:</p>
      <ul style={ul}>
        <li style={li}><strong>Synthesis</strong> (building threads): title and text of your notes that are not yet assigned to a thread, plus titles and summaries of existing threads.</li>
        <li style={li}><strong>AI voice notes</strong> (Pro): the dictated text, to detect title, content, checklist and reminder.</li>
      </ul>
      <p style={p}>
        This text is sent to Anthropic (Claude, see section 5). Anthropic does not use it for training and,
        according to its own information, deletes it after 30 days at the latest. There is no automated
        decision with legal effect within the meaning of Art. 22 GDPR. Legal basis: Art. 6(1)(b) GDPR.
      </p>
      <p style={p}>
        Notes may contain sensitive information (e.g. about health). If you put such notes into an AI
        feature, you do so at your explicit request (Art. 9(2)(a) GDPR). If you do not want this, keep
        those notes out of threads or do not use the AI features.
      </p>

      <h3 style={h3}>3.4 Dictation and microphone (app)</h3>
      <p style={p}>
        For voice notes, the app uses your operating system&apos;s speech recognition. With an internet
        connection, the audio is processed by Google (Android) or Apple (iOS); without a connection, on the
        device. We neither receive nor store audio, only the recognized text. The privacy policies of{' '}
        <Ext href="https://policies.google.com/privacy">Google</Ext> and{' '}
        <Ext href="https://www.apple.com/legal/privacy/">Apple</Ext> apply to speech recognition. You grant
        and revoke microphone access in your system settings.
      </p>

      <h3 style={h3}>3.5 Sharing and bookmarklet</h3>
      <p style={p}>
        If you share text from another app with Velm, it is saved as a note. The bookmarklet (web) takes
        the selected text, the page title and the address of the page where you trigger it, and saves them
        as a note in your account. Legal basis: Art. 6(1)(b) GDPR.
      </p>

      <h3 style={h3}>3.6 Paid plans</h3>
      <p style={p}>
        If you take out a paid subscription, Stripe processes the payment. You enter payment details
        (e.g. card number) directly with Stripe; we only receive subscription status, amount, date and a
        customer ID. Legal bases: Art. 6(1)(b) GDPR (contract) and (c) (retention obligations under tax
        and commercial law).
      </p>

      <h3 style={h3}>3.7 Technical data on access</h3>
      <p style={p}>
        When you open the web app or call our server interfaces, our host processes technically necessary
        data (IP address, time, requested address, browser identifier) in server logs to deliver the service
        and prevent abuse. Before dictation, the app checks with a short request to www.velmnote.com whether
        an internet connection is available. On start, the app also asks Expo for app updates, transmitting
        IP address, app version and platform. Logs are deleted automatically after a short time. Legal basis:
        Art. 6(1)(f) GDPR (legitimate interest in a secure, working service).
      </p>

      <h3 style={h3}>3.8 Browser storage</h3>
      <p style={p}>
        The web app only stores in your browser (localStorage/sessionStorage) what the service needs: your
        sign-in session, your chosen language, whether you have seen the introduction, and a short-lived
        cache of the graph. No cookies are set for tracking or advertising. Legal basis: Section 165(3)
        TKG 2021 (Austrian Telecommunications Act), Art. 6(1)(b) GDPR.
      </p>

      <h2 style={h2}>4. Location and security</h2>
      <p style={p}>
        Our database (Supabase) is located in Frankfurt am Main, Germany. Our server functions (Vercel) also
        run in Frankfurt. All connections are TLS-encrypted; every row in the database can only be read by
        the account it belongs to.
      </p>

      <h2 style={h2}>5. Recipients and processors</h2>
      <ul style={ul}>
        <li style={li}><strong>Supabase Inc.</strong> (USA; data in Frankfurt) – database and sign-in. <Ext href="https://supabase.com/privacy">Privacy</Ext></li>
        <li style={li}><strong>Resend</strong> (Plus Five Five, Inc., USA) – delivery of emails with confirmation and sign-in codes (email address, code, language). <Ext href="https://resend.com/legal/privacy-policy">Privacy</Ext></li>
        <li style={li}><strong>Vercel Inc.</strong> (USA; functions in Frankfurt) – hosting of the web app and server interfaces. <Ext href="https://vercel.com/legal/privacy-policy">Privacy</Ext></li>
        <li style={li}><strong>Anthropic PBC</strong> (USA) – AI processing as described in section 3.3. <Ext href="https://www.anthropic.com/legal/privacy">Privacy</Ext></li>
        <li style={li}><strong>650 Industries, Inc. (Expo)</strong> (USA) – delivery of app updates. <Ext href="https://expo.dev/privacy">Privacy</Ext></li>
        <li style={li}><strong>Stripe</strong> (Stripe Payments Europe Ltd., Ireland, and Stripe, Inc., USA) – payment processing for subscriptions. <Ext href="https://stripe.com/privacy">Privacy</Ext></li>
      </ul>
      <p style={p}>
        Where these providers act on our behalf, we have data processing agreements with them (Art. 28 GDPR).
        We do not sell data or share it for advertising.
      </p>

      <h2 style={h2}>6. Transfers to third countries</h2>
      <p style={p}>
        The providers based in the USA may process personal data in the USA. This is based on the European
        Commission&apos;s adequacy decision for the EU-US Data Privacy Framework where the provider is certified,
        and otherwise on the EU Standard Contractual Clauses (Art. 46(2)(c) GDPR), which are part of the
        respective data processing agreements.
      </p>

      <h2 style={h2}>7. Retention</h2>
      <ul style={ul}>
        <li style={li}>Local data: until you delete it or uninstall the app.</li>
        <li style={li}>Account and content: until you delete your account. Notes you delete permanently are removed from the server immediately.</li>
        <li style={li}>Unconfirmed registrations: deleted immediately if cancelled, otherwise after 30 days at the latest.</li>
        <li style={li}>AI input at Anthropic: at most 30 days.</li>
        <li style={li}>Server logs: a few days.</li>
        <li style={li}>Invoices and payment records: 7 years (Section 132 Austrian Federal Fiscal Code, BAO), also after the account is deleted.</li>
      </ul>

      <h2 style={h2}>8. Your rights</h2>
      <p style={p}>You have the right to</p>
      <ul style={ul}>
        <li style={li}><strong>access</strong> (Art. 15 GDPR),</li>
        <li style={li}><strong>rectification</strong> (Art. 16) – you can edit your notes yourself at any time,</li>
        <li style={li}><strong>erasure</strong> (Art. 17) – directly in the app under Settings → Privacy &amp; GDPR → “Delete account &amp; all data”; this removes your account, email address and all content locally and on the server,</li>
        <li style={li}><strong>restriction of processing</strong> (Art. 18),</li>
        <li style={li}><strong>data portability</strong> (Art. 20) – export all notes and threads as JSON under Settings → Privacy &amp; GDPR,</li>
        <li style={li}><strong>object</strong> (Art. 21) to processing based on legitimate interests (section 3.7),</li>
        <li style={li}><strong>withdraw</strong> consent with effect for the future (Art. 7(3)).</li>
      </ul>
      <p style={p}>
        Send requests to <a style={a} href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>; we respond within
        one month. You can also lodge a complaint with a data protection supervisory authority (Art. 77 GDPR),
        in particular in the country where you live. The authority responsible for us is the Austrian Data
        Protection Authority (Datenschutzbehörde), Barichgasse 40–42, 1030 Vienna,{' '}
        <Ext href="https://www.dsb.gv.at">www.dsb.gv.at</Ext>.
      </p>

      <h2 style={h2}>9. Obligation to provide data</h2>
      <p style={p}>
        You are not obliged to provide us with data. Without an email address you cannot create an account;
        the app then keeps working locally, without sync, web app and AI features.
      </p>

      <h2 style={h2}>10. Minimum age</h2>
      <p style={p}>Velm is intended for people aged 16 and over.</p>

      <h2 style={h2}>11. Changes</h2>
      <p style={p}>
        We update this policy when the service or the law changes. The current version is always on this page;
        we inform you in the app about material changes.
      </p>
    </LegalPage>
  );
}
