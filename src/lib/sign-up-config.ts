/** When true, new email/password registrations are blocked (existing users can sign in). */
export function signUpDisabled(): boolean {
  return process.env["DISABLE_SIGN_UP"]?.trim().toLowerCase() === "true";
}

export function registrationLoginHref(): string {
  return signUpDisabled() ? "/login" : "/signup";
}
