/**
 * Angaben zum Anbieter — einzige Quelle für Impressum und Datenschutzerklärung (DE + EN).
 * Vor dem Launch die Platzhalter in eckigen Klammern ersetzen (ladungsfähige Anschrift,
 * kein Postfach; wer die Wohnadresse nicht zeigen will: Impressums-/c/o-Service).
 */
export const OPERATOR = {
  name: 'Louis Muhr',
  business: { de: 'Velm (Einzelunternehmen)', en: 'Velm (sole proprietorship)' },
  street: '[Straße Hausnummer]',
  city: '[PLZ Ort]',
  country: { de: 'Deutschland', en: 'Germany' },
  email: 'louismuhr8@gmail.com',
  /** Zweiter schneller Kontaktweg nach § 5 DDG (Telefon oder Kontaktformular). */
  phone: '[Telefonnummer]',
  /** Leer lassen, solange keine USt-IdNr. vergeben ist (z. B. Kleinunternehmer). */
  vatId: '',
};

export const PRIVACY_UPDATED = { de: '4. November 2026', en: 'November 4, 2026' };
