/**
 * Angaben zum Anbieter — einzige Quelle für Impressum und Datenschutzerklärung (DE + EN).
 * Sitz in Österreich: Impressum nach § 5 ECG + Offenlegung nach § 25 MedienG.
 * Die Gewerbe-Angaben erst nach der Gewerbeanmeldung (GISA) ausfüllen — leere Felder werden nicht angezeigt.
 */
export const OPERATOR = {
  name: 'Louis Muhr',
  business: { de: 'Velm (Einzelunternehmen)', en: 'Velm (sole proprietorship)' },
  street: 'Döblergasse 3',
  city: '1070 Wien',
  country: { de: 'Österreich', en: 'Austria' },
  email: 'louismuhr8@gmail.com',
  phone: '+43 670 6043311',
  /** Unternehmensgegenstand (§ 25 MedienG). */
  purpose: {
    de: 'Entwicklung und Betrieb der Notiz-App Velm',
    en: 'Development and operation of the Velm note-taking app',
  },
  /** UID-Nummer — leer lassen, solange keine vergeben ist (z. B. Kleinunternehmer). */
  vatId: '',
  /** Nach der Gewerbeanmeldung ausfüllen (steht auf dem GISA-Auszug). */
  trade: { de: '', en: '' },
  /** Gewerbebehörde, z. B. „Magistratisches Bezirksamt …" laut GISA-Auszug. */
  authority: '',
  /** Kammerzugehörigkeit, bei Gewerbe automatisch: Wirtschaftskammer Wien. */
  chamber: { de: '', en: '' },
};

export const PRIVACY_UPDATED = { de: '5. November 2026', en: 'November 5, 2026' };
