import type { Metadata } from 'next';
import LegalPage, { legal } from '@/components/LegalPage';
import { OPERATOR } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Legal Notice – Velm',
  description: 'Provider identification under Section 5 DDG (German Digital Services Act).',
};

// English counterpart of app/impressum/page.tsx — keep both in sync.
export default function ImprintPageEn() {
  return (
    <LegalPage lang="en" kind="imprint" title="Legal Notice">
      <h2 style={legal.h2}>Information pursuant to Section 5 DDG</h2>
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

      {OPERATOR.vatId && (
        <>
          <h2 style={legal.h2}>VAT ID</h2>
          <p style={legal.p}>VAT identification number pursuant to Section 27a UStG: {OPERATOR.vatId}</p>
        </>
      )}

      <h2 style={legal.h2}>Responsible for content</h2>
      <p style={legal.p}>{OPERATOR.name}, address as above.</p>

      <h2 style={legal.h2}>Consumer dispute resolution</h2>
      <p style={legal.p}>
        We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer
        arbitration board.
      </p>
    </LegalPage>
  );
}
