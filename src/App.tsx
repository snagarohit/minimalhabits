import { useState, useCallback, useEffect, useMemo } from 'react'
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
import { Calendar, ViewMode } from './components/Calendar'
import { DayView } from './components/DayView'
import { DayModal } from './components/DayModal'
import { Legend } from './components/Legend'
import { EditPanel } from './components/EditPanel'
import { CloudBackupDialog } from './components/CloudBackupDialog'
import { ResponsiveDialog } from './components/ResponsiveDialog'
import { WelcomeScreen } from './components/WelcomeScreen'
import { TermsOfService } from './components/TermsOfService'
import { PrivacyPolicy } from './components/PrivacyPolicy'
import { useHabits } from './hooks/useHabits'
import { useFeedback } from './hooks/useFeedback'
import { useGoogleAuth } from './hooks/useGoogleAuth'
import { useCloudSync } from './hooks/useCloudSync'
import { Toaster } from './components/ui/sonner'
import type { HabitData } from './types'

// Check if user has accepted terms
function hasAcceptedTerms(): boolean {
  try {
    const acceptance = localStorage.getItem('legal-acceptance')
    if (!acceptance) return false
    const parsed = JSON.parse(acceptance)
    return parsed.termsAccepted && parsed.privacyAccepted
  } catch {
    return false
  }
}

function App() {
  // Legal acceptance state
  const [hasAccepted, setHasAccepted] = useState(() => hasAcceptedTerms())

  // Google Auth
  const {
    isSignedIn,
    isLoading: isAuthLoading,
    user,
    signIn,
    signOut,
    getAccessToken,
    refreshToken,
  } = useGoogleAuth()

  // Cloud sync callback
  const handleCloudDataChange = useCallback((_data: HabitData) => {
    // This will be called when local data changes
    // We'll pass it to useCloudSync to trigger save
  }, [])

  const {
    habits,
    completions,
    groups,
    timedEntries,
    isLoaded,
    addHabit,
    updateHabit,
    deleteHabit,
    addGroup,
    updateGroup,
    deleteGroup,
    toggleGroupVisibility,
    toggleBinary,
    getCompletionValue,
    getStreak,
    loadAllData,
    getAllData,
    deleteAllData,
    addTimedEntry,
    updateTimedEntry,
    deleteTimedEntry,
  } = useHabits({
    onDataChange: handleCloudDataChange,
  })

  // Cloud Sync
  const {
    syncStatus,
    syncNow,
    saveToCloud,
  } = useCloudSync({
    accessToken: getAccessToken(),
    isSignedIn,
    localData: getAllData(),
    onDataLoaded: loadAllData,
    onTokenRefresh: refreshToken,
  })

  // Trigger cloud save when data changes
  useEffect(() => {
    if (isSignedIn && isLoaded) {
      saveToCloud(getAllData())
    }
  }, [habits, completions, groups, timedEntries, isSignedIn, isLoaded, saveToCloud, getAllData])

  const { celebrate } = useFeedback()

  const [modalDateString, setModalDateString] = useState<string | null>(null)
  const [showEditPanel, setShowEditPanel] = useState(false)
  const [editPanelInitialMode, setEditPanelInitialMode] = useState<'list' | 'add-habit'>('list')
  const [showCloudDialog, setShowCloudDialog] = useState(false)
  const [showAnalyticsDialog, setShowAnalyticsDialog] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [visibleHabitIds, setVisibleHabitIds] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('habit-calendar-view-mode')
    // Migrate 'week' to 'month' since we removed week view
    if (saved === 'week') return 'month'
    return (saved as ViewMode) || 'month'
  })
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [displayMonth, setDisplayMonth] = useState(() => new Date()) // For header display (updates on scroll)
  const [visibleDates, setVisibleDates] = useState<string[]>([]) // Dates currently visible in calendar scroll
  const [navDirection, setNavDirection] = useState<'left' | 'right' | 'none'>('none')
  const [navKey, setNavKey] = useState(0) // Used to trigger animation on date change

  // Persist view mode
  useEffect(() => {
    localStorage.setItem('habit-calendar-view-mode', viewMode)
  }, [viewMode])

  // Navigation helpers

  const goToPrev = useCallback(() => {
    setNavDirection('left')
    setNavKey(k => k + 1)
    if (viewMode === 'day') {
      setCurrentDate(d => subDays(d, 1))
      setDisplayMonth(d => subDays(d, 1))
    } else if (viewMode === 'month') {
      setCurrentDate(d => subMonths(d, 1))
      setDisplayMonth(d => subMonths(d, 1))
    } else {
      setCurrentDate(d => subWeeks(d, 1))
      setDisplayMonth(d => subWeeks(d, 1))
    }
  }, [viewMode])

  const goToNext = useCallback(() => {
    setNavDirection('right')
    setNavKey(k => k + 1)
    if (viewMode === 'day') {
      setCurrentDate(d => addDays(d, 1))
      setDisplayMonth(d => addDays(d, 1))
    } else if (viewMode === 'month') {
      setCurrentDate(d => addMonths(d, 1))
      setDisplayMonth(d => addMonths(d, 1))
    } else {
      setCurrentDate(d => addWeeks(d, 1))
      setDisplayMonth(d => addWeeks(d, 1))
    }
  }, [viewMode])

  const goToToday = useCallback(() => {
    setNavDirection('none')
    setNavKey(k => k + 1)
    setCurrentDate(new Date())
    setDisplayMonth(new Date())
  }, [])

  // Format header label based on view mode
  const headerLabel = useMemo(() => {
    if (viewMode === 'day') {
      // Always show day name, even for today (consistent styling)
      return format(currentDate, 'EEE')
    }
    // For month view, use displayMonth (which updates on scroll)
    return format(displayMonth, 'MMMM yyyy')
  }, [viewMode, currentDate, displayMonth])

  const headerSubLabel = useMemo(() => {
    if (viewMode === 'day') {
      return format(currentDate, 'MMM d')
    }
    return null
  }, [viewMode, currentDate])

  // Initialize visibility when habits load - all visible by default
  useEffect(() => {
    if (isLoaded && habits.length > 0) {
      setVisibleHabitIds((prev) => {
        const newSet = new Set(prev)
        // Add any new habits to visible set
        habits.forEach((h) => {
          if (!newSet.has(h.id) && prev.size === 0) {
            newSet.add(h.id)
          } else if (!prev.has(h.id) && prev.size > 0) {
            // New habit added - make it visible
            newSet.add(h.id)
          }
        })
        // Remove deleted habits
        newSet.forEach((id) => {
          if (!habits.find((h) => h.id === id)) {
            newSet.delete(id)
          }
        })
        return newSet
      })
    }
  }, [isLoaded, habits])

  const handleToggleVisibility = useCallback((habitId: string) => {
    setVisibleHabitIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(habitId)) {
        newSet.delete(habitId)
      } else {
        newSet.add(habitId)
      }
      return newSet
    })
  }, [])

  // Handle group visibility toggle - affects all habits in group
  const handleToggleGroupVisibility = useCallback((groupId: string) => {
    toggleGroupVisibility(groupId)
    // Also update local visibleHabitIds
    const group = groups.find(g => g.id === groupId)
    if (group) {
      const habitsInGroup = habits.filter(h => h.groupId === groupId)
      setVisibleHabitIds((prev) => {
        const newSet = new Set(prev)
        if (group.visible) {
          // Group was visible, now hiding - remove all habits in group
          habitsInGroup.forEach(h => newSet.delete(h.id))
        } else {
          // Group was hidden, now showing - add all habits in group
          habitsInGroup.forEach(h => newSet.add(h.id))
        }
        return newSet
      })
    }
  }, [groups, habits, toggleGroupVisibility])

  const handleDayClick = useCallback((dateString: string) => {
    // Switch to Day View and navigate to the clicked date
    const [year, month, day] = dateString.split('-').map(Number)
    setCurrentDate(new Date(year, month - 1, day))
    setViewMode('day')
  }, [])

  const handleCloseModal = useCallback(() => {
    setModalDateString(null)
  }, [])

  // Filter habits for calendar display (respecting both individual and group visibility)
  const visibleHabits = useMemo(() => {
    return habits.filter((h) => {
      // Check individual visibility
      if (!visibleHabitIds.has(h.id)) return false
      // Check group visibility
      if (h.groupId) {
        const group = groups.find(g => g.id === h.groupId)
        if (group && !group.visible) return false
      }
      return true
    })
  }, [habits, visibleHabitIds, groups])

  // Compute which habits have completions in the current view
  const habitsWithDataInView = useMemo(() => {
    // Find which visible habits have completions in visible dates
    const habitIdsWithData = new Set<string>()

    if (viewMode === 'day') {
      // Day view: check only current date
      const dateString = format(currentDate, 'yyyy-MM-dd')
      for (const habit of visibleHabits) {
        const value = getCompletionValue(habit.id, dateString)
        if (value > 0) {
          habitIdsWithData.add(habit.id)
        }
      }
    } else if (viewMode === 'workweek') {
      // Workweek view: check week dates
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
      const dates = eachDayOfInterval({ start: weekStart, end: weekEnd })
      for (const date of dates) {
        const dateString = format(date, 'yyyy-MM-dd')
        for (const habit of visibleHabits) {
          if (habitIdsWithData.has(habit.id)) continue
          const value = getCompletionValue(habit.id, dateString)
          if (value > 0) {
            habitIdsWithData.add(habit.id)
          }
        }
      }
    } else {
      // Month view: use visible dates from scroll position
      for (const dateString of visibleDates) {
        for (const habit of visibleHabits) {
          if (habitIdsWithData.has(habit.id)) continue
          const value = getCompletionValue(habit.id, dateString)
          if (value > 0) {
            habitIdsWithData.add(habit.id)
          }
        }
      }
    }

    return visibleHabits.filter(h => habitIdsWithData.has(h.id))
  }, [viewMode, currentDate, visibleDates, visibleHabits, getCompletionValue])

  // Compute display colors for habits shown in current view
  // Uses a curated palette for ≤10 habits, falls back to algorithmic for more
  // Assigned based on what's visible in legend, sorted alphabetically
  const habitDisplayColors = useMemo(() => {
    const colorMap = new Map<string, string>()

    // Curated palette - hand-picked for maximum distinguishability
    const PALETTE = [
      '#e60049', // red
      '#0bb4ff', // cyan
      '#50e991', // green
      '#e6d800', // yellow
      '#9b19f5', // purple
      '#ffa300', // orange
      '#dc0ab4', // magenta
      '#00bfa0', // teal
      '#4421af', // indigo
      '#b3d4ff', // light blue
    ]

    // Sort habits alphabetically by name
    const sortedHabits = [...habitsWithDataInView].sort((a, b) =>
      a.name.localeCompare(b.name)
    )

    const k = sortedHabits.length

    if (k <= PALETTE.length) {
      // Use curated palette
      sortedHabits.forEach((habit, i) => {
        colorMap.set(habit.id, PALETTE[i])
      })
    } else {
      // Fall back to evenly-spaced hues in HSL for >10 habits
      sortedHabits.forEach((habit, i) => {
        const hue = Math.round((i * 360) / k)
        colorMap.set(habit.id, `hsl(${hue}, 70%, 60%)`)
      })
    }

    return colorMap
  }, [habitsWithDataInView])

  // Show welcome screen if user hasn't accepted terms
  if (!hasAccepted) {
    return <WelcomeScreen onAccept={() => setHasAccepted(true)} />
  }

  if (!isLoaded) {
    return (
      <div className="flex h-screen-safe items-center justify-center bg-zinc-950">
        <div className="text-sm text-zinc-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen-safe bg-zinc-950 text-zinc-100 safe-area-top">
      {/* Desktop: centered container, Mobile: full width */}
      <div className="mx-auto max-w-3xl h-screen-safe flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 border-b border-zinc-800 px-3 py-2">
          {/* Row 1: Title + Action buttons */}
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-base font-semibold text-zinc-100">Minimal Habits</h1>
            <div className="flex items-center">
              {/* Analytics button */}
              <button
                onClick={() => setShowAnalyticsDialog(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition-colors hover:text-zinc-100 hover:bg-zinc-800"
                title="Analytics"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </button>

              {/* Edit button */}
              <button
                onClick={() => setShowEditPanel(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition-colors hover:text-zinc-100 hover:bg-zinc-800 ml-1"
                title="Edit habits"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </button>

              {/* Profile button (opens cloud/settings) */}
              <button
                onClick={() => setShowCloudDialog(true)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 transition-colors hover:bg-zinc-800 ml-1 ${
                  isSignedIn ? 'text-zinc-100' : 'text-zinc-500'
                }`}
                title={isSignedIn ? user?.name || 'Profile' : 'Sign in'}
              >
                {isSignedIn && user?.picture ? (
                  <img src={user.picture} alt="" className="h-5 w-5 rounded-full" />
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                )}
              </button>

            </div>
          </div>

          {/* Row 2: Jump button | Navigation | View selector */}
          <div className="flex items-center justify-between">
            {/* Left: Jump to today (always visible, consistent) */}
            <button
              onClick={goToToday}
              className="px-2 py-1 text-xs font-medium rounded-lg border border-zinc-700 transition-colors text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            >
              Today
            </button>

            {/* Center: Navigation arrows + Date */}
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrev}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg border border-zinc-700 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>

              <div className="flex items-center gap-1.5 min-w-0 px-1">
                <span className="text-sm font-medium text-zinc-100 truncate">
                  {headerLabel}
                </span>
                {headerSubLabel && (
                  <span className="text-xs text-zinc-500">{headerSubLabel}</span>
                )}
              </div>

              <button
                onClick={goToNext}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg border border-zinc-700 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            {/* Right: View mode tabs */}
            <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-700">
              {(['day', 'month'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === mode
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {mode === 'day' ? 'Day' : 'Month'}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main view (on top, takes most space) */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <div
            key={`${viewMode}-${navKey}`}
            className={`h-full ${
              navDirection === 'left' ? 'animate-slide-right' :
              navDirection === 'right' ? 'animate-slide-left' :
              'animate-fade-in'
            }`}
          >
          {viewMode === 'day' ? (
            <DayView
              date={currentDate}
              habits={habits}
              groups={groups}
              timedEntries={timedEntries}
              completions={getAllData().completions}
              habitDisplayColors={habitDisplayColors}
              visibleHabitIds={visibleHabitIds}
              onToggleVisibility={handleToggleVisibility}
              onToggleGroupVisibility={handleToggleGroupVisibility}
              onAddTimedEntry={addTimedEntry}
              onUpdateTimedEntry={updateTimedEntry}
              onDeleteTimedEntry={deleteTimedEntry}
              onToggleCompletion={toggleBinary}
              onCelebrate={celebrate}
              onOpenEditPanel={(mode) => {
                setEditPanelInitialMode(mode || 'list')
                setShowEditPanel(true)
              }}
              onCloseEditPanel={() => {
                setShowEditPanel(false)
                setEditPanelInitialMode('list')
              }}
              onShowAbout={() => setShowAbout(true)}
            />
          ) : (
            <Calendar
              habits={visibleHabits}
              habitDisplayColors={habitDisplayColors}
              getCompletionValue={getCompletionValue}
              onDayClick={handleDayClick}
              onVisibleDatesChange={setVisibleDates}
              viewMode={viewMode}
              currentDate={currentDate}
            />
          )}
          </div>
        </div>

        {/* Footer branding + Legend (hidden in day view - it has its own) */}
        {viewMode !== 'day' && (
          <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-950">
            <div className="px-4 py-2.5">
              {/* Branding */}
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-600 mb-2">
                <span className="font-medium text-zinc-500">Minimal Habits</span>
                <button
                  onClick={() => setShowAbout(true)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                </button>
                <span>·</span>
                <span>Designed in <span className="text-zinc-500">Cupertino</span></span>
                <span>·</span>
                <span className="text-zinc-500">Naga Samineni</span>
              </div>

              {/* Legend */}
              <Legend
                habits={habits}
                groups={groups}
                visibleHabitIds={visibleHabitIds}
                habitDisplayColors={habitDisplayColors}
                habitsInView={habitsWithDataInView}
                onToggleVisibility={handleToggleVisibility}
                onToggleGroupVisibility={handleToggleGroupVisibility}
              />
            </div>
          </div>
        )}

      </div>

      {/* Edit panel */}
      <EditPanel
        isOpen={showEditPanel}
        onClose={() => {
          setShowEditPanel(false)
          setEditPanelInitialMode('list')
        }}
        habits={habits}
        groups={groups}
        getStreak={getStreak}
        onAddHabit={(options) => {
          const newHabit = addHabit(options)
          setVisibleHabitIds((prev) => new Set([...prev, newHabit.id]))
          return newHabit
        }}
        onUpdateHabit={updateHabit}
        onDeleteHabit={deleteHabit}
        onAddGroup={addGroup}
        onDeleteGroup={deleteGroup}
        onUpdateGroup={(groupId, name) => updateGroup(groupId, { name })}
        initialMode={editPanelInitialMode}
      />

      {modalDateString && (
        <DayModal
          dateString={modalDateString}
          habits={habits}
          groups={groups}
          getCompletionValue={getCompletionValue}
          onToggleBinary={toggleBinary}
          onClose={handleCloseModal}
          onCelebrate={celebrate}
        />
      )}

      {/* Cloud backup dialog */}
      <CloudBackupDialog
        isOpen={showCloudDialog}
        onClose={() => setShowCloudDialog(false)}
        isSignedIn={isSignedIn}
        isLoading={isAuthLoading}
        user={user}
        syncStatus={syncStatus}
        onSignIn={signIn}
        onSignOut={signOut}
        onSyncNow={syncNow}
        onDeleteAllData={deleteAllData}
      />

      {/* Analytics coming soon dialog */}
      <ResponsiveDialog
        isOpen={showAnalyticsDialog}
        onClose={() => setShowAnalyticsDialog(false)}
        title="Analytics"
      >
        <div className="px-4 py-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
            <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <p className="text-sm text-zinc-300 mb-2">Coming Soon</p>
          <p className="text-xs text-zinc-500">
            Track your habit streaks, completion rates, and trends over time.
          </p>
        </div>
      </ResponsiveDialog>

      {/* About dialog */}
      <ResponsiveDialog
        isOpen={showAbout}
        onClose={() => setShowAbout(false)}
        title="About"
      >
        <div className="px-4 py-6">
          {/* App info */}
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-zinc-100">Minimal Habits</h2>
            <p className="text-xs text-zinc-500 mt-1">Track your daily habits with simplicity</p>
          </div>

          {/* Legal links */}
          <div className="space-y-2">
            <button
              onClick={() => {
                setShowAbout(false)
                setShowTerms(true)
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
            >
              <span className="text-sm text-zinc-300">Terms of Service</span>
              <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
            <button
              onClick={() => {
                setShowAbout(false)
                setShowPrivacy(true)
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
            >
              <span className="text-sm text-zinc-300">Privacy Policy</span>
              <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Branding */}
          <div className="mt-6 pt-4 border-t border-zinc-800 text-center">
            <p className="text-[10px] text-zinc-600">
              Designed in Cupertino
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">
              © {new Date().getFullYear()} Naga Samineni. All Rights Reserved.
            </p>
          </div>
        </div>
      </ResponsiveDialog>

      {/* Terms of Service dialog */}
      <TermsOfService isOpen={showTerms} onClose={() => setShowTerms(false)} />

      {/* Privacy Policy dialog */}
      <PrivacyPolicy isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />

      {/* Toast notifications */}
      <Toaster />
    </div>
  )
}

export default App
