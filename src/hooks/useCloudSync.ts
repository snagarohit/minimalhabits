import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { saveToGDrive, loadFromGDrive, type TokenRefreshCallback } from '../services/driveStorage'
import type { HabitData } from '../types'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

interface UseCloudSyncOptions {
  accessToken: string | null
  isSignedIn: boolean
  localData: HabitData
  onDataLoaded: (data: HabitData) => void
  onTokenRefresh?: TokenRefreshCallback
}

interface UseCloudSyncReturn {
  syncStatus: SyncStatus
  lastSyncTime: Date | null
  syncError: string | null
  syncNow: () => Promise<void>
  saveToCloud: (data: HabitData) => void
}

const SYNC_DEBOUNCE_MS = 2000 // Wait 2 seconds after last change before syncing

export function useCloudSync({
  accessToken,
  isSignedIn,
  localData,
  onDataLoaded,
  onTokenRefresh,
}: UseCloudSyncOptions): UseCloudSyncReturn {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingDataRef = useRef<HabitData | null>(null)
  const isMountedRef = useRef(true)
  const localDataRef = useRef(localData)

  // Keep localDataRef up to date
  useEffect(() => {
    localDataRef.current = localData
  }, [localData])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const loadFromCloud = useCallback(async (source: 'init' | 'visibility' | 'manual' = 'manual') => {
    if (!accessToken) return

    setSyncStatus('syncing')
    setSyncError(null)

    const sourceLabel = source === 'init' ? 'Initial' : source === 'visibility' ? 'Tab visible' : 'Manual'
    toast.loading(`${sourceLabel}: Syncing from cloud...`, { id: 'cloud-sync' })

    try {
      const { data: cloudData } = await loadFromGDrive(accessToken, onTokenRefresh)

      if (!isMountedRef.current) return

      if (cloudData) {
        // Merge strategy: use cloud data if it has more recent changes
        // For now, we'll use cloud data and merge any local-only items
        const currentLocalData = localDataRef.current
        const mergedData = mergeData(currentLocalData, cloudData)

        // Only update local data if merged is different from current local
        if (!isDataEqual(mergedData, currentLocalData)) {
          onDataLoaded(mergedData)
        }

        // Save merged data back to cloud only if different from cloud
        if (!isDataEqual(mergedData, cloudData)) {
          await saveToGDrive(accessToken, mergedData, onTokenRefresh)
          toast.success(`${sourceLabel}: Synced & merged with cloud`, { id: 'cloud-sync' })
        } else {
          toast.success(`${sourceLabel}: Up to date`, { id: 'cloud-sync' })
        }
      } else {
        // No cloud data, upload local data
        const currentLocalData = localDataRef.current
        if (currentLocalData.habits.length > 0 || currentLocalData.groups.length > 0) {
          await saveToGDrive(accessToken, currentLocalData, onTokenRefresh)
          toast.success(`${sourceLabel}: Uploaded to cloud`, { id: 'cloud-sync' })
        } else {
          toast.success(`${sourceLabel}: No data to sync`, { id: 'cloud-sync' })
        }
      }

      if (isMountedRef.current) {
        setSyncStatus('synced')
        setLastSyncTime(new Date())
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Sync failed'
      toast.error(`${sourceLabel}: ${errorMsg}`, { id: 'cloud-sync' })
      if (isMountedRef.current) {
        setSyncStatus('error')
        setSyncError(errorMsg)
      }
    }
  }, [accessToken, onDataLoaded, onTokenRefresh])

  // Load from cloud on sign in
  useEffect(() => {
    if (isSignedIn && accessToken) {
      loadFromCloud('init')
    }
  }, [isSignedIn, accessToken, loadFromCloud])

  const syncNow = useCallback(async () => {
    if (!accessToken || !isSignedIn) return

    setSyncStatus('syncing')
    setSyncError(null)

    try {
      await saveToGDrive(accessToken, localDataRef.current, onTokenRefresh)

      if (isMountedRef.current) {
        setSyncStatus('synced')
        setLastSyncTime(new Date())
      }
    } catch (error) {
      if (isMountedRef.current) {
        setSyncStatus('error')
        setSyncError(error instanceof Error ? error.message : 'Sync failed')
      }
    }
  }, [accessToken, isSignedIn, onTokenRefresh])

  // Debounced save to cloud
  const saveToCloud = useCallback((data: HabitData) => {
    if (!accessToken || !isSignedIn) return

    pendingDataRef.current = data

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    setSyncStatus('syncing')

    // Set new timeout
    saveTimeoutRef.current = setTimeout(async () => {
      const dataToSave = pendingDataRef.current
      if (!dataToSave || !accessToken) return

      toast.loading('Saving to cloud...', { id: 'cloud-save' })

      try {
        await saveToGDrive(accessToken, dataToSave, onTokenRefresh)

        if (isMountedRef.current) {
          setSyncStatus('synced')
          setLastSyncTime(new Date())
          setSyncError(null)
          toast.success('Saved to cloud', { id: 'cloud-save' })
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Save failed'
        toast.error(`Save failed: ${errorMsg}`, { id: 'cloud-save' })
        if (isMountedRef.current) {
          setSyncStatus('error')
          setSyncError(errorMsg)
        }
      }
    }, SYNC_DEBOUNCE_MS)
  }, [accessToken, isSignedIn, onTokenRefresh])

  // Sync when tab becomes visible (for cross-device sync)
  useEffect(() => {
    if (!isSignedIn || !accessToken) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible, sync from cloud to get latest data
        loadFromCloud('visibility')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isSignedIn, accessToken, loadFromCloud])

  return {
    syncStatus,
    lastSyncTime,
    syncError,
    syncNow,
    saveToCloud,
  }
}

/**
 * Merge local and cloud data
 * Strategy: Include all items from both, preferring cloud versions for conflicts
 * Active timers: Only one per habit (keep earliest startTimestamp)
 * Timed entries: Merge by ID first, then overlapping entries will be merged by useHabits
 */
function mergeData(local: HabitData, cloud: HabitData): HabitData {
  const mergedHabits = new Map<string, typeof local.habits[0]>()
  const mergedCompletions = new Map<string, typeof local.completions[0]>()
  const mergedGroups = new Map<string, typeof local.groups[0]>()
  const mergedTimedEntries = new Map<string, NonNullable<typeof local.timedEntries>[0]>()
  // For active timers, key by habitId (only one timer per habit, keep earliest)
  const mergedActiveTimers = new Map<string, NonNullable<typeof local.activeTimers>[0]>()

  // Add cloud data first (takes precedence)
  cloud.habits.forEach(h => mergedHabits.set(h.id, h))
  cloud.completions.forEach(c => mergedCompletions.set(`${c.habitId}-${c.date}`, c))
  cloud.groups.forEach(g => mergedGroups.set(g.id, g))
  cloud.timedEntries?.forEach(e => mergedTimedEntries.set(e.id, e))
  // For timers: key by habitId, keep earliest
  cloud.activeTimers?.forEach(t => {
    const existing = mergedActiveTimers.get(t.habitId)
    if (!existing || t.startTimestamp < existing.startTimestamp) {
      mergedActiveTimers.set(t.habitId, t)
    }
  })

  // Add local data (only if not already in cloud)
  local.habits.forEach(h => {
    if (!mergedHabits.has(h.id)) {
      mergedHabits.set(h.id, h)
    }
  })
  local.completions.forEach(c => {
    const key = `${c.habitId}-${c.date}`
    if (!mergedCompletions.has(key)) {
      mergedCompletions.set(key, c)
    }
  })
  local.groups.forEach(g => {
    if (!mergedGroups.has(g.id)) {
      mergedGroups.set(g.id, g)
    }
  })
  local.timedEntries?.forEach(e => {
    if (!mergedTimedEntries.has(e.id)) {
      mergedTimedEntries.set(e.id, e)
    }
  })
  // For timers: key by habitId, keep earliest
  local.activeTimers?.forEach(t => {
    const existing = mergedActiveTimers.get(t.habitId)
    if (!existing || t.startTimestamp < existing.startTimestamp) {
      mergedActiveTimers.set(t.habitId, t)
    }
  })

  return {
    habits: Array.from(mergedHabits.values()),
    completions: Array.from(mergedCompletions.values()),
    groups: Array.from(mergedGroups.values()),
    timedEntries: Array.from(mergedTimedEntries.values()),
    activeTimers: Array.from(mergedActiveTimers.values()),
  }
}

/**
 * Check if two HabitData objects are equivalent (for avoiding unnecessary syncs)
 */
function isDataEqual(a: HabitData, b: HabitData): boolean {
  // Quick length checks first
  if (a.habits.length !== b.habits.length) return false
  if (a.completions.length !== b.completions.length) return false
  if (a.groups.length !== b.groups.length) return false
  if ((a.timedEntries?.length || 0) !== (b.timedEntries?.length || 0)) return false
  if ((a.activeTimers?.length || 0) !== (b.activeTimers?.length || 0)) return false

  // Deep comparison via JSON (simple but effective for our use case)
  return JSON.stringify(a) === JSON.stringify(b)
}
