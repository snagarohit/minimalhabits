export const config = {
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined,
}

export function isGoogleAuthEnabled(): boolean {
  return !!config.googleClientId
}
