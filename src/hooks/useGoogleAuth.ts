import { useState, useEffect, useCallback, useRef } from 'react'
import { config, isGoogleAuthEnabled } from '../config'

// Type declarations for Google APIs
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient
          initCodeClient: (config: CodeClientConfig) => CodeClient
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

interface CodeClientConfig {
  client_id: string
  scope: string
  ux_mode?: 'popup' | 'redirect'
  callback: (response: CodeResponse) => void
  error_callback?: (error: { type: string; message: string }) => void
  // Required for refresh tokens
  access_type?: 'offline' | 'online'
  prompt?: 'none' | 'consent' | 'select_account'
}

interface CodeClient {
  requestCode: () => void
}

interface CodeResponse {
  code: string
  error?: string
}

export interface GoogleUser {
  email: string
  name: string
  picture: string
}

export interface Account {
  user: GoogleUser
  accessToken: string
  refreshToken: string
  expiresAt: number
}

interface StoredAccounts {
  accounts: Account[]
  activeEmail: string | null
}

interface UseGoogleAuthReturn {
  isEnabled: boolean
  isInitialized: boolean
  isSignedIn: boolean
  isLoading: boolean
  user: GoogleUser | null
  accounts: Account[]
  error: string | null
  addAccount: () => void
  switchAccount: (email: string) => void
  removeAccount: (email: string) => void
  signOut: () => void
  getAccessToken: () => string | null
  refreshToken: () => Promise<string | null>
}

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata email profile'
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
const STORAGE_KEY = 'habit-google-accounts'
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000 // Refresh 5 min before expiry

function loadStoredAccounts(): StoredAccounts {
  if (typeof window === 'undefined') {
    return { accounts: [], activeEmail: null }
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load accounts:', e)
  }
  return { accounts: [], activeEmail: null }
}

function saveStoredAccounts(data: StoredAccounts): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save accounts:', e)
  }
}

export function useGoogleAuth(): UseGoogleAuthReturn {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [activeEmail, setActiveEmail] = useState<string | null>(null)

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null)
  const isEnabled = isGoogleAuthEnabled()

  // Derived state
  const activeAccount = accounts.find(a => a.user.email === activeEmail) || null
  const user = activeAccount?.user || null
  const isSignedIn = !!activeAccount

  // Schedule automatic token refresh for active account
  const scheduleTokenRefresh = useCallback((expiresAt: number) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }

    const refreshTime = expiresAt - TOKEN_REFRESH_BUFFER_MS - Date.now()
    if (refreshTime <= 0) return

    refreshTimerRef.current = setTimeout(() => {
      console.log('Auto-refreshing token...')
      doRefreshToken()
    }, refreshTime)
  }, [])

  // Refresh token for active account
  const doRefreshToken = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current
    }

    if (!activeAccount?.refreshToken) {
      console.error('No refresh token available')
      return null
    }

    const promise = (async (): Promise<string | null> => {
      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: activeAccount.refreshToken }),
        })

        const data = await response.json()

        if (!response.ok) {
          console.error('Token refresh failed:', data.error)
          // Remove failed account
          const newAccounts = accounts.filter(a => a.user.email !== activeEmail)
          const newActiveEmail = newAccounts.length > 0 ? newAccounts[0].user.email : null
          setAccounts(newAccounts)
          setActiveEmail(newActiveEmail)
          saveStoredAccounts({ accounts: newAccounts, activeEmail: newActiveEmail })
          return null
        }

        if (window.gapi?.client) {
          window.gapi.client.setToken({ access_token: data.access_token })
        }

        const expiresAt = Date.now() + (data.expires_in * 1000)

        // Update the account
        const newAccounts = accounts.map(a => {
          if (a.user.email === activeEmail) {
            return {
              ...a,
              accessToken: data.access_token,
              refreshToken: data.refresh_token || a.refreshToken,
              expiresAt,
            }
          }
          return a
        })

        setAccounts(newAccounts)
        saveStoredAccounts({ accounts: newAccounts, activeEmail })
        scheduleTokenRefresh(expiresAt)
        return data.access_token
      } catch (err) {
        console.error('Failed to refresh token:', err)
        return null
      } finally {
        refreshPromiseRef.current = null
      }
    })()

    refreshPromiseRef.current = promise
    return promise
  }, [activeAccount, activeEmail, accounts, scheduleTokenRefresh])

  // Refresh token for a specific account (used during initialization)
  const refreshAccountToken = useCallback(async (account: Account): Promise<Account | null> => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: account.refreshToken }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Token refresh failed for', account.user.email)
        return null
      }

      return {
        ...account,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || account.refreshToken,
        expiresAt: Date.now() + (data.expires_in * 1000),
      }
    } catch (err) {
      console.error('Failed to refresh token for', account.user.email, err)
      return null
    }
  }, [])

  // Initialize
  useEffect(() => {
    if (!isEnabled) {
      setIsInitialized(true)
      return
    }

    let mounted = true

    const initialize = async () => {
      try {
        await waitForGoogleScripts()

        await new Promise<void>((resolve) => {
          window.gapi!.load('client', async () => {
            await window.gapi!.client.init({
              discoveryDocs: [DISCOVERY_DOC],
            })
            resolve()
          })
        })

        if (!mounted) return

        setIsInitialized(true)

        // Load stored accounts
        const stored = loadStoredAccounts()
        if (stored.accounts.length === 0) return

        // Refresh expired tokens
        const refreshedAccounts: Account[] = []
        for (const account of stored.accounts) {
          if (account.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
            // Token still valid
            refreshedAccounts.push(account)
          } else if (account.refreshToken) {
            // Need to refresh
            const refreshed = await refreshAccountToken(account)
            if (refreshed) {
              refreshedAccounts.push(refreshed)
            }
          }
        }

        if (refreshedAccounts.length === 0) {
          saveStoredAccounts({ accounts: [], activeEmail: null })
          return
        }

        // Determine active account
        let newActiveEmail = stored.activeEmail
        if (!refreshedAccounts.find(a => a.user.email === newActiveEmail)) {
          newActiveEmail = refreshedAccounts[0].user.email
        }

        setAccounts(refreshedAccounts)
        setActiveEmail(newActiveEmail)
        saveStoredAccounts({ accounts: refreshedAccounts, activeEmail: newActiveEmail })

        // Set gapi token for active account
        const active = refreshedAccounts.find(a => a.user.email === newActiveEmail)
        if (active) {
          window.gapi!.client.setToken({ access_token: active.accessToken })
          scheduleTokenRefresh(active.expiresAt)
        }
      } catch (err) {
        console.error('Failed to initialize Google Auth:', err)
        if (mounted) {
          setError('Failed to initialize Google Auth')
          setIsInitialized(true)
        }
      }
    }

    initialize()

    return () => {
      mounted = false
    }
  }, [isEnabled, refreshAccountToken, scheduleTokenRefresh])

  // Add a new account
  const addAccount = useCallback(() => {
    if (!isInitialized || !window.google?.accounts?.oauth2) {
      console.error('Google Auth not initialized')
      return
    }

    setIsLoading(true)
    setError(null)

    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: config.googleClientId!,
      scope: SCOPES,
      ux_mode: 'popup',
      // Request offline access to get a refresh token for long-lived sessions
      access_type: 'offline',
      // Force consent to ensure we always get a refresh token (even for returning users)
      prompt: 'consent',
      callback: async (response: CodeResponse) => {
        if (response.error) {
          console.error('OAuth error:', response.error)
          setError(response.error)
          setIsLoading(false)
          return
        }

        try {
          const tokenResponse = await fetch('/api/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: response.code }),
          })

          const tokenData = await tokenResponse.json()

          if (!tokenResponse.ok) {
            console.error('Token exchange failed:', tokenData.error)
            setError(tokenData.error || 'Token exchange failed')
            setIsLoading(false)
            return
          }

          window.gapi!.client.setToken({ access_token: tokenData.access_token })

          const userInfo = await fetchUserInfo(tokenData.access_token)
          const expiresAt = Date.now() + (tokenData.expires_in * 1000)

          const newAccount: Account = {
            user: userInfo,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt,
          }

          // Check if account already exists (update it) or add new
          const existingIndex = accounts.findIndex(a => a.user.email === userInfo.email)
          let newAccounts: Account[]
          if (existingIndex >= 0) {
            newAccounts = [...accounts]
            newAccounts[existingIndex] = newAccount
          } else {
            newAccounts = [...accounts, newAccount]
          }

          setAccounts(newAccounts)
          setActiveEmail(userInfo.email)
          saveStoredAccounts({ accounts: newAccounts, activeEmail: userInfo.email })
          scheduleTokenRefresh(expiresAt)
        } catch (err) {
          console.error('Failed to add account:', err)
          setError('Failed to add account')
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

    client.requestCode()
  }, [isInitialized, accounts, scheduleTokenRefresh])

  // Switch to a different account
  const switchAccount = useCallback((email: string) => {
    const account = accounts.find(a => a.user.email === email)
    if (!account) {
      console.error('Account not found:', email)
      return
    }

    setActiveEmail(email)
    saveStoredAccounts({ accounts, activeEmail: email })

    if (window.gapi?.client) {
      window.gapi.client.setToken({ access_token: account.accessToken })
    }

    // Schedule refresh for new active account
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }
    scheduleTokenRefresh(account.expiresAt)
  }, [accounts, scheduleTokenRefresh])

  // Remove an account and delete its local data
  const removeAccount = useCallback((email: string) => {
    const account = accounts.find(a => a.user.email === email)
    if (account?.accessToken) {
      window.google?.accounts.oauth2.revoke?.(account.accessToken, () => {
        console.log('Token revoked for', email)
      })
    }

    // Delete user's local habit data
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9@._-]/g, '_')
    localStorage.removeItem(`habit-calendar-data-${sanitizedEmail}`)

    const newAccounts = accounts.filter(a => a.user.email !== email)
    let newActiveEmail = activeEmail

    // If removing active account, switch to another or null
    if (email === activeEmail) {
      newActiveEmail = newAccounts.length > 0 ? newAccounts[0].user.email : null

      if (newActiveEmail) {
        const newActive = newAccounts.find(a => a.user.email === newActiveEmail)
        if (newActive && window.gapi?.client) {
          window.gapi.client.setToken({ access_token: newActive.accessToken })
          scheduleTokenRefresh(newActive.expiresAt)
        }
      } else {
        window.gapi?.client.setToken(null)
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current)
        }
      }
    }

    setAccounts(newAccounts)
    setActiveEmail(newActiveEmail)
    saveStoredAccounts({ accounts: newAccounts, activeEmail: newActiveEmail })
  }, [accounts, activeEmail, scheduleTokenRefresh])

  // Sign out all accounts
  const signOut = useCallback(() => {
    // Revoke all tokens
    for (const account of accounts) {
      window.google?.accounts.oauth2.revoke?.(account.accessToken, () => {
        console.log('Token revoked for', account.user.email)
      })
    }

    window.gapi?.client.setToken(null)
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }

    setAccounts([])
    setActiveEmail(null)
    saveStoredAccounts({ accounts: [], activeEmail: null })
  }, [accounts])

  // Get access token for active account
  const getAccessToken = useCallback((): string | null => {
    return activeAccount?.accessToken || null
  }, [activeAccount])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [])

  return {
    isEnabled,
    isInitialized,
    isSignedIn,
    isLoading,
    user,
    accounts,
    error,
    addAccount,
    switchAccount,
    removeAccount,
    signOut,
    getAccessToken,
    refreshToken: doRefreshToken,
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
