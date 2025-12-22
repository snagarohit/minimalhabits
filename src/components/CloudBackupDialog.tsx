import { useState } from 'react'
import { ResponsiveDialog } from './ResponsiveDialog'
import type { Account } from '../hooks/useGoogleAuth'

interface CloudBackupDialogProps {
  isOpen: boolean
  onClose: () => void
  isSignedIn: boolean
  isLoading: boolean
  user: { email: string; name: string; picture?: string } | null
  accounts: Account[]
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error' | 'offline'
  onAddAccount: () => void
  onSwitchAccount: (email: string) => void
  onRemoveAccount: (email: string) => void
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
  accounts,
  syncStatus,
  onAddAccount,
  onSwitchAccount,
  onRemoveAccount,
  onSyncNow,
  onDeleteAllData,
}: CloudBackupDialogProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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
    <ResponsiveDialog isOpen={isOpen} onClose={onClose} title="Accounts">
      <div className="px-4 py-3">
        {/* Account list */}
        {accounts.length > 0 && (
          <div className="space-y-1 mb-3">
            {accounts.map((account) => {
              const isActive = account.user.email === user?.email
              return (
                <div
                  key={account.user.email}
                  className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                    isActive ? 'bg-zinc-800' : 'hover:bg-zinc-900'
                  }`}
                >
                  {/* Clickable area to switch account */}
                  <button
                    onClick={() => {
                      if (!isActive) {
                        onSwitchAccount(account.user.email)
                      }
                    }}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    {account.user.picture ? (
                      <img src={account.user.picture} alt="" className="w-9 h-9 rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 text-sm font-medium">
                        {account.user.name?.charAt(0) || '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-200 truncate">{account.user.name}</span>
                        {isActive && (
                          <svg className="h-4 w-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 truncate">{account.user.email}</div>
                    </div>
                  </button>

                  {/* Sync status for active account */}
                  {isActive && syncStatus !== 'idle' && (
                    <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                      syncStatus === 'synced' ? 'text-green-500 bg-green-500/10' :
                      syncStatus === 'error' ? 'text-red-500 bg-red-500/10' :
                      syncStatus === 'offline' ? 'text-yellow-500 bg-yellow-500/10' :
                      'text-zinc-400 bg-zinc-800'
                    }`}>
                      {syncStatus === 'syncing' ? (
                        <>
                          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span>Syncing</span>
                        </>
                      ) : syncStatus === 'synced' ? (
                        <span>Synced</span>
                      ) : syncStatus === 'error' ? (
                        <span>Error</span>
                      ) : syncStatus === 'offline' ? (
                        <span>Offline</span>
                      ) : null}
                    </div>
                  )}

                  {/* Sign out button */}
                  <button
                    onClick={() => onRemoveAccount(account.user.email)}
                    className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Sync now button (only show if signed in) */}
        {isSignedIn && (
          <button
            onClick={onSyncNow}
            disabled={syncStatus === 'syncing'}
            className="w-full py-2 px-4 mb-3 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Sync now
          </button>
        )}

        {/* Add account / Sign in button */}
        <button
          onClick={() => {
            onClose()
            onAddAccount()
          }}
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {accounts.length > 0 ? 'Add another account' : 'Sign in with Google'}
        </button>

        {/* Info text for non-signed-in users */}
        {!isSignedIn && (
          <p className="text-xs text-zinc-600 text-center mt-3">
            Sign in to backup your habits to Google Drive
          </p>
        )}

        {/* Delete all data */}
        <div className="pt-3 mt-3 border-t border-zinc-800">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-2 px-4 rounded-lg text-red-400 text-sm hover:text-red-300 hover:bg-red-950/30 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Delete all data
          </button>
        </div>
      </div>
    </ResponsiveDialog>
  )
}
