export const config = {
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string | undefined,
}

export function isGoogleAuthEnabled(): boolean {
  return !!config.googleClientId
}
