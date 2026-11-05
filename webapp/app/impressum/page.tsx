import type { Metadata } from 'next';
import LegalPage, { legal } from '@/components/LegalPage';
import { OPERATOR } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Impressum – Velm',
  description: 'Informationspflicht nach § 5 ECG und Offenlegung nach § 25 MedienG.',
};

// Sitz in Österreich: § 5 E-Commerce-Gesetz + § 25 Mediengesetz. Gewerbe-Angaben erscheinen,
// sobald sie in lib/legal.ts eingetragen sind.
export default function ImpressumPage() {
  return (
    <LegalPage lang="de" kind="imprint" title="Impressum">
      <h2 style={legal.h2}>Informationspflicht nach § 5 ECG und Offenlegung nach § 25 MedienG</h2>
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

      <h2 style={legal.h2}>Unternehmensgegenstand</h2>
      <p style={legal.p}>{OPERATOR.purpose.de}</p>

      {(OPERATOR.trade.de || OPERATOR.authority || OPERATOR.chamber.de || OPERATOR.vatId) && (
        <>
          <h2 style={legal.h2}>Gewerberechtliche Angaben</h2>
          <p style={legal.p}>
            {OPERATOR.trade.de && <>Gewerbe: {OPERATOR.trade.de}<br /></>}
            {OPERATOR.authority && <>Gewerbebehörde: {OPERATOR.authority}<br /></>}
            {OPERATOR.chamber.de && <>Mitglied der {OPERATOR.chamber.de}<br /></>}
            {OPERATOR.trade.de && <>Anwendbare Rechtsvorschrift: Gewerbeordnung, abrufbar unter{' '}
              <a style={legal.a} href="https://www.ris.bka.gv.at" target="_blank" rel="noopener noreferrer">www.ris.bka.gv.at</a><br /></>}
            {OPERATOR.vatId && <>UID-Nummer: {OPERATOR.vatId}</>}
          </p>
        </>
      )}

      <h2 style={legal.h2}>Medieninhaber und Herausgeber</h2>
      <p style={legal.p}>
        {OPERATOR.name}, {OPERATOR.city}. Grundlegende Richtung: Informationen über die App Velm und deren Bereitstellung.
      </p>

      <h2 style={legal.h2}>Verbraucherstreitbeilegung</h2>
      <p style={legal.p}>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </LegalPage>
  );
}
