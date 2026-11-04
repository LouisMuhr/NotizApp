import type { Metadata } from 'next';
import LegalPage, { legal } from '@/components/LegalPage';
import { OPERATOR } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Impressum – Velm',
  description: 'Anbieterkennzeichnung nach § 5 DDG.',
};

export default function ImpressumPage() {
  return (
    <LegalPage lang="de" kind="imprint" title="Impressum">
      <h2 style={legal.h2}>Angaben gemäß § 5 DDG</h2>
      <p style={legal.p}>
        {OPERATOR.name}<br />
        {OPERATOR.business.de}<br />
        {OPERATOR.street}<br />
        {OPERATOR.city}<br />
        {OPERATOR.country.de}
      </p>

      <h2 style={legal.h2}>Kontakt</h2>
      <p style={legal.p}>
        E-Mail: <a style={legal.a} href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a><br />
        Telefon: {OPERATOR.phone}
      </p>

      {OPERATOR.vatId && (
        <>
          <h2 style={legal.h2}>Umsatzsteuer-ID</h2>
          <p style={legal.p}>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: {OPERATOR.vatId}</p>
        </>
      )}

      <h2 style={legal.h2}>Verantwortlich für den Inhalt</h2>
      <p style={legal.p}>{OPERATOR.name}, Anschrift wie oben.</p>

      <h2 style={legal.h2}>Verbraucherstreitbeilegung</h2>
      <p style={legal.p}>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </LegalPage>
  );
}
