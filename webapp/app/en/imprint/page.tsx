import type { Metadata } from 'next';
import LegalPage, { legal } from '@/components/LegalPage';
import { OPERATOR } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Legal Notice – Velm',
  description: 'Information pursuant to Section 5 ECG and disclosure pursuant to Section 25 MedienG (Austria).',
};

// English counterpart of app/impressum/page.tsx — keep both in sync.
export default function ImprintPageEn() {
  return (
    <LegalPage lang="en" kind="imprint" title="Legal Notice">
      <h2 style={legal.h2}>Information pursuant to Section 5 ECG and disclosure pursuant to Section 25 MedienG (Austria)</h2>
      <p style={legal.p}>
        {OPERATOR.name}<br />
        {OPERATOR.business.en}<br />
        {OPERATOR.street}<br />
        {OPERATOR.city}<br />
        {OPERATOR.country.en}
      </p>

      <h2 style={legal.h2}>Contact</h2>
      <p style={legal.p}>
        Email: <a style={legal.a} href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a><br />
        Phone: {OPERATOR.phone}
      </p>

      <h2 style={legal.h2}>Business purpose</h2>
      <p style={legal.p}>{OPERATOR.purpose.en}</p>

      {(OPERATOR.trade.en || OPERATOR.authority || OPERATOR.chamber.en || OPERATOR.vatId) && (
        <>
          <h2 style={legal.h2}>Trade information</h2>
          <p style={legal.p}>
            {OPERATOR.trade.en && <>Trade: {OPERATOR.trade.en}<br /></>}
            {OPERATOR.authority && <>Trade authority: {OPERATOR.authority}<br /></>}
            {OPERATOR.chamber.en && <>Member of the {OPERATOR.chamber.en}<br /></>}
            {OPERATOR.trade.en && <>Applicable regulation: Austrian Trade Regulation Act (Gewerbeordnung), available at{' '}
              <a style={legal.a} href="https://www.ris.bka.gv.at" target="_blank" rel="noopener noreferrer">www.ris.bka.gv.at</a><br /></>}
            {OPERATOR.vatId && <>VAT ID: {OPERATOR.vatId}</>}
          </p>
        </>
      )}

      <h2 style={legal.h2}>Media owner and publisher</h2>
      <p style={legal.p}>
        {OPERATOR.name}, {OPERATOR.city}. Basic orientation: information about the Velm app and its provision.
      </p>

      <h2 style={legal.h2}>Consumer dispute resolution</h2>
      <p style={legal.p}>
        We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer
        arbitration board.
      </p>
    </LegalPage>
  );
}
