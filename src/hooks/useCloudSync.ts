import { useState, useCallback, useRef, useEffect } from 'react'
import { saveToGDrive, loadFromGDrive } from '../services/driveStorage'
import type { HabitData } from '../types'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

interface UseCloudSyncOptions {
  accessToken: string | null
  isSignedIn: boolean
  localData: HabitData
  onDataLoaded: (data: HabitData) => void
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
}: UseCloudSyncOptions): UseCloudSyncReturn {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingDataRef = useRef<HabitData | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Load from cloud on sign in
  useEffect(() => {
    if (isSignedIn && accessToken) {
      loadFromCloud()
    }
  }, [isSignedIn, accessToken])

  const loadFromCloud = async () => {
    if (!accessToken) return

    setSyncStatus('syncing')
    setSyncError(null)

    try {
      const { data: cloudData } = await loadFromGDrive(accessToken)

      if (!isMountedRef.current) return

      if (cloudData) {
        // Merge strategy: use cloud data if it has more recent changes
        // For now, we'll use cloud data and merge any local-only items
        const mergedData = mergeData(localData, cloudData)
        onDataLoaded(mergedData)

        // Save merged data back to cloud if different
        if (JSON.stringify(mergedData) !== JSON.stringify(cloudData)) {
          await saveToGDrive(accessToken, mergedData)
        }
      } else {
        // No cloud data, upload local data
        if (localData.habits.length > 0 || localData.groups.length > 0) {
          await saveToGDrive(accessToken, localData)
        }
      }

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
  }

  const syncNow = useCallback(async () => {
    if (!accessToken || !isSignedIn) return

    setSyncStatus('syncing')
    setSyncError(null)

    try {
      await saveToGDrive(accessToken, localData)

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
  }, [accessToken, isSignedIn, localData])

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

      try {
        await saveToGDrive(accessToken, dataToSave)

        if (isMountedRef.current) {
          setSyncStatus('synced')
          setLastSyncTime(new Date())
          setSyncError(null)
        }
      } catch (error) {
        if (isMountedRef.current) {
          setSyncStatus('error')
          setSyncError(error instanceof Error ? error.message : 'Sync failed')
        }
      }
    }, SYNC_DEBOUNCE_MS)
  }, [accessToken, isSignedIn])

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
 */
function mergeData(local: HabitData, cloud: HabitData): HabitData {
  const mergedHabits = new Map<string, typeof local.habits[0]>()
  const mergedCompletions = new Map<string, typeof local.completions[0]>()
  const mergedGroups = new Map<string, typeof local.groups[0]>()

  // Add cloud data first (takes precedence)
  cloud.habits.forEach(h => mergedHabits.set(h.id, h))
  cloud.completions.forEach(c => mergedCompletions.set(`${c.habitId}-${c.date}`, c))
  cloud.groups.forEach(g => mergedGroups.set(g.id, g))

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

  return {
    habits: Array.from(mergedHabits.values()),
    completions: Array.from(mergedCompletions.values()),
    groups: Array.from(mergedGroups.values()),
  }
}
