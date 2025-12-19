import { useState } from 'react'
import { ResponsiveDialog } from './ResponsiveDialog'
import { TermsOfService } from './TermsOfService'
import { PrivacyPolicy } from './PrivacyPolicy'

interface CloudBackupDialogProps {
  isOpen: boolean
  onClose: () => void
  isSignedIn: boolean
  isLoading: boolean
  user: { email: string; name: string } | null
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error' | 'offline'
  onSignIn: () => void
  onSignOut: () => void
  onSyncNow: () => void
  onDeleteAllData: () => void
}

export function CloudBackupDialog({
  isOpen,
  onClose,
  isSignedIn,
  isLoading,
  user,
  syncStatus,
  onSignIn,
  onSignOut,
  onSyncNow,
  onDeleteAllData,
}: CloudBackupDialogProps) {
  const [showTerms, setShowTerms] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (showTerms) {
    return (
      <TermsOfService
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
      />
    )
  }

  if (showPrivacy) {
    return (
      <PrivacyPolicy
        isOpen={showPrivacy}
        onClose={() => setShowPrivacy(false)}
      />
    )
  }

  if (showDeleteConfirm) {
    return (
      <ResponsiveDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete All Data"
      >
        <div className="px-4 py-4 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-950/50 border border-red-900/50 rounded-lg">
            <svg className="h-6 w-6 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div className="text-sm text-red-200">
              This will permanently delete all your habits, entries, and groups. This action cannot be undone.
            </div>
          </div>

          <div className="text-xs text-zinc-500">
            {isSignedIn ? (
              <p>Note: This will only delete local data. Your cloud backup will remain in Google Drive until you manually delete it.</p>
            ) : (
              <p>All data stored on this device will be permanently erased.</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-2.5 px-4 rounded-lg bg-zinc-800 text-zinc-200 text-sm hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onDeleteAllData()
                setShowDeleteConfirm(false)
                onClose()
              }}
              className="flex-1 py-2.5 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors"
            >
              Delete Everything
            </button>
          </div>
        </div>
      </ResponsiveDialog>
    )
  }

  return (
    <ResponsiveDialog isOpen={isOpen} onClose={onClose} title="Cloud Backup">
      <div className="px-4 py-4">
        {isSignedIn ? (
          // Signed in state
          <div className="space-y-4">
            {/* User info */}
            <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 text-lg font-medium">
                {user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-200 truncate">{user?.name}</div>
                <div className="text-xs text-zinc-500 truncate">{user?.email}</div>
              </div>
              <div className={`flex items-center gap-1.5 text-xs ${
                syncStatus === 'synced' ? 'text-green-500' :
                syncStatus === 'error' ? 'text-red-500' :
                syncStatus === 'offline' ? 'text-yellow-500' :
                'text-zinc-400'
              }`}>
                {syncStatus === 'syncing' ? (
                  <>
                    <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Syncing
                  </>
                ) : syncStatus === 'synced' ? (
                  <>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Synced
                  </>
                ) : syncStatus === 'error' ? (
                  <>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    Error
                  </>
                ) : syncStatus === 'offline' ? (
                  <>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l8.735 8.735m0 0a.374.374 0 11.53.53m-.53-.53l.53.53m0 0L21 21M14.652 9.348a3.75 3.75 0 010 5.304m2.121-7.425a6.75 6.75 0 010 9.546m2.121-11.667c3.808 3.807 3.808 9.98 0 13.788m-9.546-4.242a3.733 3.733 0 01-1.06-2.122m-1.061 4.243a6.75 6.75 0 01-1.625-6.929m-.496 9.05c-3.068-3.067-3.664-7.67-1.79-11.334M12 12h.008v.008H12V12z" />
                    </svg>
                    Offline
                  </>
                ) : null}
              </div>
            </div>

            {/* Info about backup */}
            <div className="text-xs text-zinc-500 space-y-2">
              <p>Your habits are automatically backed up to Google Drive whenever you make changes.</p>
              <p>Data is stored securely in your Google Drive's app data folder, which only this app can access.</p>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={onSyncNow}
                disabled={syncStatus === 'syncing'}
                className="w-full py-2.5 px-4 rounded-lg bg-zinc-800 text-zinc-200 text-sm hover:bg-zinc-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Sync now
              </button>
              <button
                onClick={onSignOut}
                className="w-full py-2.5 px-4 rounded-lg text-zinc-400 text-sm hover:text-zinc-200 hover:bg-zinc-900 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Sign out
              </button>
            </div>

            {/* Danger Zone */}
            <div className="pt-4 mt-4 border-t border-zinc-800">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2.5 px-4 rounded-lg text-red-400 text-sm hover:text-red-300 hover:bg-red-950/30 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Delete all data
              </button>
            </div>
          </div>
        ) : (
          // Not signed in state
          <div className="space-y-4">
            {/* Cloud icon and explanation */}
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 mb-4">
                <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                </svg>
              </div>
              <h3 className="text-base font-medium text-zinc-200 mb-2">Backup to Google Drive</h3>
              <p className="text-sm text-zinc-500">
                Keep your habit data safe and sync across devices by backing up to your Google Drive.
              </p>
            </div>

            {/* Benefits list */}
            <div className="space-y-3 px-2">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-zinc-400">
                  <strong className="text-zinc-300">Automatic backups</strong> - Your data syncs automatically whenever you make changes
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-zinc-400">
                  <strong className="text-zinc-300">Private and secure</strong> - Data is stored in your own Google Drive, encrypted in transit
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-zinc-400">
                  <strong className="text-zinc-300">Cross-device sync</strong> - Access your habits from any device where you're signed in
                </div>
              </div>
            </div>

            {/* Sign in button */}
            <button
              onClick={onSignIn}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continue with Google
            </button>

            {/* Terms and Privacy */}
            <p className="text-xs text-zinc-600 text-center">
              By signing in, you agree to our{' '}
              <button
                onClick={() => setShowTerms(true)}
                className="text-zinc-400 hover:text-zinc-300 underline"
              >
                Terms of Service
              </button>{' '}
              and{' '}
              <button
                onClick={() => setShowPrivacy(true)}
                className="text-zinc-400 hover:text-zinc-300 underline"
              >
                Privacy Policy
              </button>
            </p>

            {/* Danger Zone */}
            <div className="pt-4 mt-4 border-t border-zinc-800">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2.5 px-4 rounded-lg text-red-400 text-sm hover:text-red-300 hover:bg-red-950/30 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Delete all data
              </button>
            </div>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  )
}
