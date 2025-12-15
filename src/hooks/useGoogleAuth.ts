import { useState, useEffect, useCallback, useRef } from 'react'
import { config, isGoogleAuthEnabled } from '../config'

// Type declarations for Google APIs
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient
          revoke?: (token: string, callback: () => void) => void
        }
      }
    }
    gapi?: {
      load: (api: string, callback: () => void) => void
      client: {
        init: (config: { discoveryDocs: string[] }) => Promise<void>
        getToken: () => { access_token: string } | null
        setToken: (token: { access_token: string } | null) => void
      }
    }
  }
}

interface TokenClientConfig {
  client_id: string
  scope: string
  callback: (response: TokenResponse) => void
  error_callback?: (error: { type: string; message: string }) => void
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void
}

interface TokenResponse {
  access_token: string
  expires_in: number
  error?: string
}

export interface GoogleUser {
  email: string
  name: string
  picture: string
}

interface StoredAuth {
  user: GoogleUser
  accessToken: string
  expiresAt: number
}

interface UseGoogleAuthReturn {
  isEnabled: boolean
  isInitialized: boolean
  isSignedIn: boolean
  isLoading: boolean
  user: GoogleUser | null
  error: string | null
  signIn: () => void
  signOut: () => void
  getAccessToken: () => string | null
}

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata email profile'
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
const STORAGE_KEY = 'habit-google-auth'

export function useGoogleAuth(): UseGoogleAuthReturn {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const tokenClientRef = useRef<TokenClient | null>(null)
  const isEnabled = isGoogleAuthEnabled()

  // Initialize Google APIs
  useEffect(() => {
    if (!isEnabled) {
      setIsInitialized(true)
      return
    }

    let mounted = true

    const initializeGoogleAuth = async () => {
      try {
        // Wait for scripts to load
        await waitForGoogleScripts()

        // Initialize GAPI client
        await new Promise<void>((resolve) => {
          window.gapi!.load('client', async () => {
            await window.gapi!.client.init({
              discoveryDocs: [DISCOVERY_DOC],
            })
            resolve()
          })
        })

        if (mounted) {
          setIsInitialized(true)

          // Check for stored auth
          const stored = localStorage.getItem(STORAGE_KEY)
          if (stored) {
            try {
              const auth: StoredAuth = JSON.parse(stored)
              // Check if token is still valid (with 5 min buffer)
              if (auth.expiresAt > Date.now() + 5 * 60 * 1000) {
                setUser(auth.user)
                setAccessToken(auth.accessToken)
                setIsSignedIn(true)
                window.gapi!.client.setToken({ access_token: auth.accessToken })
              } else {
                // Token expired, clear storage
                localStorage.removeItem(STORAGE_KEY)
              }
            } catch {
              localStorage.removeItem(STORAGE_KEY)
            }
          }
        }
      } catch (err) {
        console.error('Failed to initialize Google Auth:', err)
        if (mounted) {
          setError('Failed to initialize Google Auth')
          setIsInitialized(true)
        }
      }
    }

    initializeGoogleAuth()

    return () => {
      mounted = false
    }
  }, [isEnabled])

  // Sign in
  const signIn = useCallback(() => {
    if (!isInitialized || !window.google?.accounts?.oauth2) {
      console.error('Google Auth not initialized')
      return
    }

    setIsLoading(true)
    setError(null)

    // Create token client with callback
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: config.googleClientId!,
      scope: SCOPES,
      callback: async (response: TokenResponse) => {
        if (response.error) {
          console.error('OAuth error:', response.error)
          setError(response.error)
          setIsLoading(false)
          return
        }

        try {
          // Set the token in gapi client
          window.gapi!.client.setToken({ access_token: response.access_token })

          // Fetch user info
          const userInfo = await fetchUserInfo(response.access_token)

          // Calculate expiration time
          const expiresAt = Date.now() + (response.expires_in * 1000)

          // Store auth data
          const authData: StoredAuth = {
            user: userInfo,
            accessToken: response.access_token,
            expiresAt,
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(authData))

          setUser(userInfo)
          setAccessToken(response.access_token)
          setIsSignedIn(true)
        } catch (err) {
          console.error('Failed to get user info:', err)
          setError('Failed to get user info')
        } finally {
          setIsLoading(false)
        }
      },
      error_callback: (err) => {
        console.error('OAuth error callback:', err)
        setError(err.message)
        setIsLoading(false)
      },
    })

    tokenClientRef.current = client

    // Request access token - use empty prompt for silent refresh, 'consent' for first time
    client.requestAccessToken({ prompt: '' })
  }, [isInitialized])

  // Sign out
  const signOut = useCallback(() => {
    if (accessToken) {
      // Revoke the token
      window.google?.accounts.oauth2.revoke?.(accessToken, () => {
        console.log('Token revoked')
      })
    }

    window.gapi?.client.setToken(null)
    setUser(null)
    setAccessToken(null)
    setIsSignedIn(false)
    localStorage.removeItem(STORAGE_KEY)
  }, [accessToken])

  // Get access token (for API calls)
  const getAccessToken = useCallback((): string | null => {
    return accessToken
  }, [accessToken])

  return {
    isEnabled,
    isInitialized,
    isSignedIn,
    isLoading,
    user,
    error,
    signIn,
    signOut,
    getAccessToken,
  }
}

// Helper to wait for Google scripts to load
function waitForGoogleScripts(): Promise<void> {
  return new Promise((resolve, reject) => {
    const maxAttempts = 50
    let attempts = 0

    const check = () => {
      if (window.google?.accounts?.oauth2 && window.gapi) {
        resolve()
      } else if (attempts >= maxAttempts) {
        reject(new Error('Google scripts failed to load'))
      } else {
        attempts++
        setTimeout(check, 100)
      }
    }

    check()
  })
}

// Fetch user info from Google
async function fetchUserInfo(accessToken: string): Promise<GoogleUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch user info')
  }

  const data = await response.json()
  return {
    email: data.email,
    name: data.name,
    picture: data.picture,
  }
}
