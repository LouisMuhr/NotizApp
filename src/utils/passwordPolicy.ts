// Muss zur Supabase-Einstellung passen (Auth → Email: min. 8 Zeichen, Klein-, Grossbuchstabe, Ziffer).
// Die Webapp hat dieselbe Regel in webapp/lib/passwordPolicy.ts — beide zusammen aendern.
export const PASSWORD_MIN_LENGTH = 8;

export function isPasswordStrongEnough(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

/** Supabase lehnt ein zu schwaches Passwort mit `weak_password` ab (z. B. wenn die Regel serverseitig verschaerft wurde). */
export function isWeakPasswordError(error: { code?: string; name?: string } | null | undefined): boolean {
  return error?.code === 'weak_password' || error?.name === 'AuthWeakPasswordError';
}
