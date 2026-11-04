// Muss zur Supabase-Einstellung passen (Auth → Email: min. 8 Zeichen, Klein-, Grossbuchstabe, Ziffer).
// Die App hat dieselbe Regel in src/utils/passwordPolicy.ts — beide zusammen aendern.
export const PASSWORD_MIN_LENGTH = 8;

export function isPasswordStrongEnough(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}
