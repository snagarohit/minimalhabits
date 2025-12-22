import { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { format } from 'date-fns'
import { ResponsiveDialog } from './ResponsiveDialog'
import { HabitChipList } from './HabitChipList'
import type { Habit, HabitGroup, TimedEntry, HabitCompletion } from '../types'

interface DayViewProps {
  date: Date
  habits: Habit[]
  groups: HabitGroup[]
  timedEntries: TimedEntry[]
  completions: HabitCompletion[]
  habitDisplayColors: Map<string, string>
  visibleHabitIds: Set<string>
  onToggleVisibility: (habitId: string) => void
  onToggleGroupVisibility: (groupId: string) => void
  onAddTimedEntry: (habitId: string, date: string, startTime: string, duration: number) => TimedEntry
  onUpdateTimedEntry: (id: string, updates: Partial<Omit<TimedEntry, 'id'>>) => void
  onDeleteTimedEntry: (id: string) => void
  onToggleCompletion: (habitId: string, date: string) => void
  onCelebrate: () => void
  onOpenEditPanel: (mode?: 'list' | 'add-habit') => void
  onCloseEditPanel: () => void
  onShowAbout: () => void
}

// Grid configuration: 12 AM to 12 AM = 24 hours (3 columns of 8 hours each)
const START_HOUR = 0
const HOURS_PER_COLUMN = 8
const COLUMNS = 3
const SLOTS_PER_HOUR = 4
const ROWS = HOURS_PER_COLUMN * SLOTS_PER_HOUR // 32

// Convert column and row to time
function slotToTime(col: number, row: number): { hour: number; minute: number } {
  const hourOffset = Math.floor(row / SLOTS_PER_HOUR)
  const minuteOffset = (row % SLOTS_PER_HOUR) * 15
  const hour = (START_HOUR + col * HOURS_PER_COLUMN + hourOffset) % 24
  return { hour, minute: minuteOffset }
}

// Convert time to slot position
function timeToSlot(hour: number, minute: number): { col: number; row: number } | null {
  let hoursFromStart = hour - START_HOUR
  if (hoursFromStart < 0) hoursFromStart += 24

  const col = Math.floor(hoursFromStart / HOURS_PER_COLUMN)
  const hourInCol = hoursFromStart % HOURS_PER_COLUMN
  const row = hourInCol * SLOTS_PER_HOUR + Math.floor(minute / 15)

  if (col >= COLUMNS || row >= ROWS) return null
  return { col, row }
}

// Format hour for compact display
function formatHourCompact(hour: number): string {
  const period = hour >= 12 ? 'p' : 'a'
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${display}${period}`
}

// Format time string HH:MM
function formatTimeString(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

// Format elapsed time
function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Format duration in hours and minutes
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return `${hours} hr${hours > 1 ? 's' : ''}`
  }
  return `${hours} hr${hours > 1 ? 's' : ''} ${mins} min`
}

// Storage key for persisting active timers
const TIMERS_STORAGE_KEY = 'habit-active-timers'

export function DayView({
  date,
  habits,
  groups,
  timedEntries,
  completions: _completions,
  habitDisplayColors,
  visibleHabitIds,
  onToggleVisibility,
  onToggleGroupVisibility,
  onAddTimedEntry,
  onUpdateTimedEntry,
  onDeleteTimedEntry,
  onToggleCompletion: _onToggleCompletion,
  onCelebrate,
  onOpenEditPanel,
  onCloseEditPanel,
  onShowAbout,
}: DayViewProps) {
  const dateString = format(date, 'yyyy-MM-dd')
  const gridRef = useRef<HTMLDivElement>(null)

  // Drag selection state - supports cross-column selection
  const [dragStart, setDragStart] = useState<{ col: number; row: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ col: number; row: number } | null>(null)
  const isDragging = dragStart !== null

  // Dialog state
  const [showHabitSelector, setShowHabitSelector] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<{
    startCol: number
    startRow: number
    endCol: number
    endRow: number
  } | null>(null)

  // Track if we're waiting for a habit to be created (for auto-adding to pending selection)
  const [waitingForHabit, setWaitingForHabit] = useState(false)
  const prevHabitsCountRef = useRef(habits.length)

  // Timer state - supports multiple simultaneous timers (persisted to localStorage)
  const hasInitializedRef = useRef(false)
  const [activeTimers, setActiveTimers] = useState<Array<{
    id: string
    habitId: string
    startTime: string
    startTimestamp: number
    col: number
    row: number
  }>>(() => {
    // Initialize from localStorage
    try {
      const stored = localStorage.getItem(TIMERS_STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to load timers from localStorage:', e)
    }
    return []
  })
  const [timerTick, setTimerTick] = useState(0) // Forces re-render for elapsed time

  // Persist timers to localStorage whenever they change (skip initial mount)
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      return
    }
    try {
      if (activeTimers.length > 0) {
        localStorage.setItem(TIMERS_STORAGE_KEY, JSON.stringify(activeTimers))
      } else {
        localStorage.removeItem(TIMERS_STORAGE_KEY)
      }
    } catch (e) {
      console.error('Failed to save timers to localStorage:', e)
    }
  }, [activeTimers])

  // Clean up timers when habits are deleted
  const prevHabitsRef = useRef(habits)
  useEffect(() => {
    // Only run cleanup when habits actually change (not on mount)
    const prevHabits = prevHabitsRef.current
    prevHabitsRef.current = habits

    // Skip if this is initial mount or habits haven't changed
    if (prevHabits === habits || habits.length === 0) return

    // Only clean up if a habit was removed
    if (habits.length < prevHabits.length) {
      setActiveTimers(prev => {
        const validTimers = prev.filter(t => habits.some(h => h.id === t.habitId))
        return validTimers.length !== prev.length ? validTimers : prev
      })
    }
  }, [habits])
  const [showTimerHabitSelector, setShowTimerHabitSelector] = useState(false)
  const [showVisibilityDialog, setShowVisibilityDialog] = useState(false)

  // Current time (updates every minute for slot highlighting, every second for timers)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const hasActiveTimers = activeTimers.length > 0
    const interval = setInterval(() => {
      setNow(new Date())
      if (hasActiveTimers) setTimerTick(t => t + 1)
    }, hasActiveTimers ? 1000 : 60000)
    return () => clearInterval(interval)
  }, [activeTimers.length])

  // Helper to get elapsed seconds for a timer
  const getElapsedSeconds = useCallback((startTimestamp: number) => {
    return Math.floor((Date.now() - startTimestamp) / 1000)
  }, [timerTick]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-create entry when a new habit is created while we're waiting
  useLayoutEffect(() => {
    // Check if a new habit was added while we were waiting
    if (waitingForHabit && pendingSelection && habits.length > prevHabitsCountRef.current && habits.length > 0) {
      // Get the most recently added habit (last in the array)
      const newHabit = habits[habits.length - 1]

      const { startCol, startRow, endCol, endRow } = pendingSelection
      const { hour, minute } = slotToTime(startCol, startRow)

      // Calculate total slots across columns
      const startSlot = startCol * ROWS + startRow
      const endSlot = endCol * ROWS + endRow
      const totalSlots = endSlot - startSlot + 1
      const duration = totalSlots * 15

      onAddTimedEntry(newHabit.id, dateString, formatTimeString(hour, minute), duration)
      onCelebrate()

      // Close the EditPanel since we're done - entry is logged
      onCloseEditPanel()

      // Reset state
      setWaitingForHabit(false)
      setPendingSelection(null)
    }

    // Update ref for next comparison
    prevHabitsCountRef.current = habits.length
  }, [habits, waitingForHabit, pendingSelection, dateString, onAddTimedEntry, onCelebrate, onCloseEditPanel])

  const isToday = format(now, 'yyyy-MM-dd') === dateString
  const currentSlot = useMemo(() => {
    if (!isToday) return null
    return timeToSlot(now.getHours(), now.getMinutes())
  }, [isToday, now])

  // Get entries for this day (filtered by visibility)
  const dayEntries = useMemo(() => {
    return timedEntries.filter(e => {
      if (e.date !== dateString) return false
      // Check if habit is visible
      if (!visibleHabitIds.has(e.habitId)) return false
      // Check if habit's group is visible
      const habit = habits.find(h => h.id === e.habitId)
      if (habit?.groupId) {
        const group = groups.find(g => g.id === habit.groupId)
        if (group && !group.visible) return false
      }
      return true
    })
  }, [timedEntries, dateString, visibleHabitIds, habits, groups])

  // Compute entry layout info for continuous block rendering
  // Each entry gets: column, startRow, rowSpan, and horizontal position based on overlaps
  // Supports cross-column entries (entries longer than 8 hours)
  const entryLayout = useMemo(() => {
    // First, compute the slots each entry occupies - now supports cross-column
    const entrySlots: Array<{
      entry: typeof dayEntries[0]
      col: number
      startRow: number
      rowSpan: number
    }> = []

    dayEntries.forEach(entry => {
      const [h, m] = entry.startTime.split(':').map(Number)
      const start = timeToSlot(h, m)
      if (!start) return

      const numSlots = Math.ceil(entry.duration / 15)
      const startAbsolute = start.col * ROWS + start.row
      const endAbsolute = startAbsolute + numSlots

      // Generate layout entries for each column the entry spans
      for (let col = start.col; col < COLUMNS; col++) {
        const colStartAbsolute = col * ROWS
        const colEndAbsolute = (col + 1) * ROWS

        // Check if entry occupies any slots in this column
        if (startAbsolute >= colEndAbsolute || endAbsolute <= colStartAbsolute) continue

        const rowStart = col === start.col ? start.row : 0
        const rowEnd = Math.min(ROWS, endAbsolute - colStartAbsolute)
        const rowSpan = rowEnd - rowStart

        if (rowSpan > 0) {
          entrySlots.push({
            entry,
            col,
            startRow: rowStart,
            rowSpan
          })
        }
      }
    })

    // For each slot, find which entry segments occupy it
    // Use composite key entry.id:col to handle cross-column entries
    const slotToSegmentKeys = new Map<string, Set<string>>()

    entrySlots.forEach(({ entry, col, startRow, rowSpan }) => {
      const segmentKey = `${entry.id}:${col}`
      for (let r = startRow; r < startRow + rowSpan; r++) {
        const slotKey = `${col}:${r}`
        if (!slotToSegmentKeys.has(slotKey)) slotToSegmentKeys.set(slotKey, new Set())
        slotToSegmentKeys.get(slotKey)!.add(segmentKey)
      }
    })

    // For each entry segment (entry + column), find its maximum overlap count
    // Each column segment can have different overlap counts
    const segmentMaxOverlap = new Map<string, number>()
    const segmentPosition = new Map<string, number>()

    entrySlots.forEach(({ entry, col, startRow, rowSpan }) => {
      const segmentKey = `${entry.id}:${col}`
      let maxOverlap = 1
      for (let r = startRow; r < startRow + rowSpan; r++) {
        const slotKey = `${col}:${r}`
        const count = slotToSegmentKeys.get(slotKey)?.size || 1
        maxOverlap = Math.max(maxOverlap, count)
      }
      segmentMaxOverlap.set(segmentKey, maxOverlap)
    })

    // Assign positions - group overlapping entries and assign consistent positions
    // Process column by column, row by row
    for (let col = 0; col < COLUMNS; col++) {
      const processed = new Set<string>()

      for (let row = 0; row < ROWS; row++) {
        const slotKey = `${col}:${row}`
        const segmentKeys = slotToSegmentKeys.get(slotKey)
        if (!segmentKeys) continue

        // Sort segments by their entry's start time for consistent ordering
        const sortedKeys = Array.from(segmentKeys).sort((aKey, bKey) => {
          const aId = aKey.split(':')[0]
          const bId = bKey.split(':')[0]
          const aEntry = dayEntries.find(e => e.id === aId)!
          const bEntry = dayEntries.find(e => e.id === bId)!
          const [ah, am] = aEntry.startTime.split(':').map(Number)
          const [bh, bm] = bEntry.startTime.split(':').map(Number)
          return ah * 60 + am - (bh * 60 + bm)
        })

        // Assign positions to segments that haven't been positioned yet
        const usedPositions = new Set<number>()
        sortedKeys.forEach(key => {
          if (segmentPosition.has(key)) {
            usedPositions.add(segmentPosition.get(key)!)
          }
        })

        sortedKeys.forEach((key) => {
          if (!processed.has(key)) {
            // Find first available position
            let pos = 0
            while (usedPositions.has(pos)) pos++
            segmentPosition.set(key, pos)
            usedPositions.add(pos)
            processed.add(key)
          }
        })
      }
    }

    // Build final layout
    return entrySlots.map(({ entry, col, startRow, rowSpan }) => {
      const segmentKey = `${entry.id}:${col}`
      return {
        entry,
        col,
        startRow,
        rowSpan,
        position: segmentPosition.get(segmentKey) || 0,
        maxOverlap: segmentMaxOverlap.get(segmentKey) || 1
      }
    })
  }, [dayEntries])

  // Convert col/row to absolute slot index (0 to COLUMNS*ROWS-1)
  const toAbsoluteSlot = useCallback((col: number, row: number) => col * ROWS + row, [])
  const fromAbsoluteSlot = useCallback((slot: number) => ({
    col: Math.floor(slot / ROWS),
    row: slot % ROWS
  }), [])

  // Compute timer layout - shows running timers as blocks from start to current time
  // Supports cross-column rendering when timer runs for more than 8 hours
  const timerLayout = useMemo(() => {
    if (!currentSlot || activeTimers.length === 0) return []

    const layouts: Array<{
      timer: typeof activeTimers[0]
      col: number
      startRow: number
      rowSpan: number
    }> = []

    activeTimers.forEach(timer => {
      const [h, m] = timer.startTime.split(':').map(Number)
      const startSlotPos = timeToSlot(h, m)
      if (!startSlotPos) return

      // Calculate current duration in slots (from start to now)
      const elapsedMs = Date.now() - timer.startTimestamp
      const elapsedMinutes = Math.floor(elapsedMs / 60000)
      const elapsedSlots = Math.max(1, Math.ceil(elapsedMinutes / 15))

      // Calculate absolute slot positions
      const startAbsolute = toAbsoluteSlot(startSlotPos.col, startSlotPos.row)
      const currentAbsolute = toAbsoluteSlot(currentSlot.col, currentSlot.row)
      const endAbsolute = Math.min(startAbsolute + elapsedSlots, currentAbsolute + 1)

      // Generate layout entries for each column the timer spans
      for (let col = startSlotPos.col; col < COLUMNS; col++) {
        const colStartAbsolute = col * ROWS
        const colEndAbsolute = (col + 1) * ROWS

        // Check if timer occupies any slots in this column
        if (startAbsolute >= colEndAbsolute || endAbsolute <= colStartAbsolute) continue

        const rowStart = col === startSlotPos.col ? startSlotPos.row : 0
        const rowEnd = Math.min(ROWS, endAbsolute - colStartAbsolute)
        const rowSpan = rowEnd - rowStart

        if (rowSpan > 0) {
          layouts.push({
            timer,
            col,
            startRow: rowStart,
            rowSpan
          })
        }
      }
    })

    return layouts
  }, [activeTimers, currentSlot, toAbsoluteSlot, timerTick]) // timerTick ensures updates

  // Get selected slots during drag (all slots in range across columns)
  const selectedSlots = useMemo(() => {
    const set = new Set<string>()
    if (!dragStart || !dragEnd) return set

    const startSlot = toAbsoluteSlot(dragStart.col, dragStart.row)
    const endSlot = toAbsoluteSlot(dragEnd.col, dragEnd.row)
    const minSlot = Math.min(startSlot, endSlot)
    const maxSlot = Math.max(startSlot, endSlot)

    for (let s = minSlot; s <= maxSlot; s++) {
      const { col, row } = fromAbsoluteSlot(s)
      set.add(`${col}:${row}`)
    }

    return set
  }, [dragStart, dragEnd, toAbsoluteSlot, fromAbsoluteSlot])

  // Get slot from pointer position
  const getSlotFromPointer = useCallback((e: React.PointerEvent | PointerEvent): { col: number; row: number } | null => {
    if (!gridRef.current) return null

    const gridRect = gridRef.current.getBoundingClientRect()
    const x = e.clientX - gridRect.left
    const y = e.clientY - gridRect.top

    const colWidth = gridRect.width / COLUMNS
    const rowHeight = gridRect.height / ROWS

    const col = Math.floor(x / colWidth)
    const row = Math.floor(y / rowHeight)

    if (col < 0 || col >= COLUMNS || row < 0 || row >= ROWS) return null

    return { col, row }
  }, [])

  // State for editing an entry
  const [editingEntry, setEditingEntry] = useState<string | null>(null)
  const [showChangeHabit, setShowChangeHabit] = useState(false)

  // Handle pointer down - only for drag selection (single clicks handled by slot onClick)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Don't intercept if clicking on an entry block (let onClick handle it)
    const target = e.target as HTMLElement
    if (target.closest('[data-entry]')) {
      return
    }

    const slot = getSlotFromPointer(e)
    if (!slot) return

    // Store initial position for drag detection
    const { col, row } = slot

    // Start potential drag selection - DON'T capture pointer yet (let clicks work)
    // Pointer capture will happen in handlePointerMove when actual drag detected
    setDragStart({ col, row })
    setDragEnd({ col, row })
  }, [getSlotFromPointer])

  // Handle pointer move
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStart) return

    const slot = getSlotFromPointer(e)
    if (!slot) return

    // Check if we've moved to a different slot - if so, capture pointer for dragging
    if (slot.col !== dragStart.col || slot.row !== dragStart.row) {
      gridRef.current?.setPointerCapture(e.pointerId)
    }

    // Allow cross-column selection
    setDragEnd(slot)
  }, [isDragging, dragStart, getSlotFromPointer])

  // Handle pointer up - only process if user actually dragged (multi-slot selection)
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (gridRef.current) {
      gridRef.current.releasePointerCapture(e.pointerId)
    }

    if (!isDragging || !dragStart || !dragEnd) {
      setDragStart(null)
      setDragEnd(null)
      return
    }

    // Only show selector if user dragged to multiple slots (single clicks handled by slot onClick)
    const isSingleSlot = dragStart.col === dragEnd.col && dragStart.row === dragEnd.row
    if (isSingleSlot) {
      // Single slot - let onClick handle it
      setDragStart(null)
      setDragEnd(null)
      return
    }

    // Multi-slot drag selection
    if (selectedSlots.size > 1) {
      // Normalize so start is before end
      const startSlot = toAbsoluteSlot(dragStart.col, dragStart.row)
      const endSlot = toAbsoluteSlot(dragEnd.col, dragEnd.row)
      const minSlotPos = Math.min(startSlot, endSlot)
      const maxSlotPos = Math.max(startSlot, endSlot)
      const minPos = fromAbsoluteSlot(minSlotPos)
      const maxPos = fromAbsoluteSlot(maxSlotPos)

      setPendingSelection({
        startCol: minPos.col,
        startRow: minPos.row,
        endCol: maxPos.col,
        endRow: maxPos.row
      })
      setShowHabitSelector(true)
    }

    setDragStart(null)
    setDragEnd(null)
  }, [isDragging, dragStart, dragEnd, selectedSlots, toAbsoluteSlot, fromAbsoluteSlot])

  // Handle pointer cancel
  const handlePointerCancel = useCallback(() => {
    setDragStart(null)
    setDragEnd(null)
  }, [])

  // Handle habit selection from dialog (for drag selection)
  const handleSelectHabit = useCallback((habitId: string) => {
    if (!pendingSelection) return

    const { startCol, startRow, endCol, endRow } = pendingSelection
    const { hour, minute } = slotToTime(startCol, startRow)

    // Calculate total slots across columns
    const startSlot = toAbsoluteSlot(startCol, startRow)
    const endSlot = toAbsoluteSlot(endCol, endRow)
    const totalSlots = endSlot - startSlot + 1
    const duration = totalSlots * 15

    onAddTimedEntry(habitId, dateString, formatTimeString(hour, minute), duration)
    onCelebrate()

    setShowHabitSelector(false)
    setPendingSelection(null)
  }, [pendingSelection, dateString, onAddTimedEntry, onCelebrate, toAbsoluteSlot])

  // Start timer with selected habit
  const handleStartTimer = useCallback((habitId: string) => {
    if (!currentSlot) return

    const { hour, minute } = slotToTime(currentSlot.col, currentSlot.row)
    const newTimer = {
      id: `timer-${Date.now()}`,
      habitId,
      startTime: formatTimeString(hour, minute),
      startTimestamp: Date.now(),
      col: currentSlot.col,
      row: currentSlot.row,
    }
    setActiveTimers(prev => [...prev, newTimer])
    setShowTimerHabitSelector(false)
  }, [currentSlot])

  // Convert an existing entry to a live timer (keep running from its start time)
  const handleKeepRunning = useCallback((entryId: string) => {
    const entry = dayEntries.find(e => e.id === entryId)
    if (!entry) return

    const [h, m] = entry.startTime.split(':').map(Number)
    const slot = timeToSlot(h, m)
    if (!slot) return

    // Calculate timestamp for the entry's start time
    const startDate = new Date()
    startDate.setHours(h, m, 0, 0)
    const startTimestamp = startDate.getTime()

    const newTimer = {
      id: `timer-${Date.now()}`,
      habitId: entry.habitId,
      startTime: entry.startTime,
      startTimestamp,
      col: slot.col,
      row: slot.row,
    }

    // Delete the fixed entry and start the timer
    onDeleteTimedEntry(entryId)
    setActiveTimers(prev => [...prev, newTimer])
    setEditingEntry(null)
  }, [dayEntries, onDeleteTimedEntry])

  // Stop a specific timer and save entry
  const handleStopTimer = useCallback((timerId: string) => {
    const timer = activeTimers.find(t => t.id === timerId)
    if (!timer) return

    const elapsedSeconds = getElapsedSeconds(timer.startTimestamp)
    // Round up to nearest 15 minutes, minimum 15
    const durationMinutes = Math.max(15, Math.ceil(elapsedSeconds / 60 / 15) * 15)

    onAddTimedEntry(timer.habitId, dateString, timer.startTime, durationMinutes)
    onCelebrate()

    setActiveTimers(prev => prev.filter(t => t.id !== timerId))
  }, [activeTimers, getElapsedSeconds, dateString, onAddTimedEntry, onCelebrate])

  // Get timer info helpers
  const getTimerHabit = useCallback((timer: typeof activeTimers[0]) => {
    return habits.find(h => h.id === timer.habitId)
  }, [habits])

  const getTimerColor = useCallback((timer: typeof activeTimers[0]) => {
    const habit = getTimerHabit(timer)
    return habit ? (habitDisplayColors.get(habit.id) || '#888') : '#666'
  }, [getTimerHabit, habitDisplayColors])

  // Visibility helpers for filter dialog
  const getIsSelected = useCallback((habitId: string) => {
    return visibleHabitIds.has(habitId)
  }, [visibleHabitIds])

  const getIsDisabled = useCallback((habitId: string) => {
    const habit = habits.find(h => h.id === habitId)
    if (!habit?.groupId) return false
    const group = groups.find(g => g.id === habit.groupId)
    return group ? !group.visible : false
  }, [habits, groups])

  const getIsGroupSelected = useCallback((groupId: string) => {
    const group = groups.find(g => g.id === groupId)
    return group?.visible ?? false
  }, [groups])

  const handleShowAll = useCallback(() => {
    habits.forEach(h => {
      if (!visibleHabitIds.has(h.id)) {
        onToggleVisibility(h.id)
      }
    })
    groups.forEach(g => {
      if (!g.visible) {
        onToggleGroupVisibility(g.id)
      }
    })
  }, [habits, groups, visibleHabitIds, onToggleVisibility, onToggleGroupVisibility])

  const handleHideAll = useCallback(() => {
    habits.forEach(h => {
      if (visibleHabitIds.has(h.id)) {
        onToggleVisibility(h.id)
      }
    })
  }, [habits, visibleHabitIds, onToggleVisibility])

  // Get visible habits for filter dialog
  const visibleHabits = useMemo(() => {
    return habits.filter((h) => {
      if (!visibleHabitIds.has(h.id)) return false
      if (h.groupId) {
        const group = groups.find(g => g.id === h.groupId)
        if (group && !group.visible) return false
      }
      return true
    })
  }, [habits, visibleHabitIds, groups])

  // Get habits that have entries on this day (for legend display)
  const habitsInView = useMemo(() => {
    const habitIdsWithEntries = new Set(dayEntries.map(e => e.habitId))
    return visibleHabits.filter(h => habitIdsWithEntries.has(h.id))
  }, [dayEntries, visibleHabits])

  const visibleCount = visibleHabits.length
  const totalCount = habits.length

  return (
    <div className="flex h-full flex-col">
      {/* Active timer bars - supports multiple */}
      {activeTimers.map(timer => {
        const habit = getTimerHabit(timer)
        const color = getTimerColor(timer)
        const elapsed = getElapsedSeconds(timer.startTimestamp)
        if (!habit) return null
        return (
          <div
            key={timer.id}
            className="flex-shrink-0 px-4 py-2 border-b border-zinc-800 flex items-center gap-3"
            style={{ backgroundColor: color + '20' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: color }}
            >
              {habit.emoji && (
                <span className="text-lg" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))' }}>{habit.emoji}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-100 truncate">{habit.name}</p>
              <p className="text-xs text-zinc-500">Recording...</p>
            </div>
            <span className="font-mono text-xl text-zinc-100 tabular-nums">
              {formatElapsed(elapsed)}
            </span>
            <button
              onClick={() => handleStopTimer(timer.id)}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Stop
            </button>
          </div>
        )
      })}

      {/* Grid */}
      <div
        ref={gridRef}
        className="flex-1 flex flex-col min-h-0 overflow-hidden touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
      >
        {/* Grid body */}
        <div className="flex-1 grid grid-cols-3 min-h-0 overflow-hidden">
          {Array.from({ length: COLUMNS }, (_, col) => (
            <div
              key={col}
              className="relative flex flex-col min-h-0 border-r border-zinc-800/50 last:border-r-0"
            >
              {/* Slot grid lines and indicators */}
              {Array.from({ length: ROWS }, (_, row) => {
                const key = `${col}:${row}`
                const isSelected = selectedSlots.has(key)
                const isHourStart = row % SLOTS_PER_HOUR === 0
                const isCurrent = currentSlot?.col === col && currentSlot?.row === row
                const isCurrentHour = isHourStart && currentSlot?.col === col && Math.floor(currentSlot?.row / SLOTS_PER_HOUR) === Math.floor(row / SLOTS_PER_HOUR)
                const { hour } = slotToTime(col, row)

                // Handle single click on slot to add entry
                const handleSlotClick = () => {
                  // If clicking current time slot, show timer selector
                  if (isToday && isCurrent) {
                    setShowTimerHabitSelector(true)
                    return
                  }
                  // Otherwise, open habit selector for this single slot
                  setPendingSelection({
                    startCol: col,
                    startRow: row,
                    endCol: col,
                    endRow: row
                  })
                  setShowHabitSelector(true)
                }

                return (
                  <div
                    key={row}
                    data-col={col}
                    data-row={row}
                    data-slot
                    onClick={handleSlotClick}
                    className={`
                      flex-1 relative select-none cursor-pointer
                      ${isHourStart ? 'border-t border-zinc-700/50' : 'border-t border-zinc-800/30'}
                      ${isCurrent ? 'bg-zinc-800/50' : ''}
                    `}
                  >
                    {/* Hour label in left gutter - always visible on hour-start slots */}
                    {isHourStart && (
                      <div className="absolute left-0 top-0 bottom-0 w-[15%] flex items-center justify-center pointer-events-none z-10">
                        {isCurrent && isCurrentHour ? (
                          /* Current slot IS the hour start - breathing with contrast */
                          <div className="relative w-4 h-4">
                            {/* Base layer: dark circle with light text (visible when breathing fades) */}
                            <div className="absolute inset-0 rounded-full bg-zinc-800 flex items-center justify-center">
                              <span className="text-[7px] font-medium leading-none text-zinc-100">
                                {formatHourCompact(hour)}
                              </span>
                            </div>
                            {/* Breathing layer: light circle with dark text */}
                            <div className="absolute inset-0 rounded-full bg-zinc-100 flex items-center justify-center animate-breathe">
                              <span className="text-[7px] font-medium leading-none text-zinc-900">
                                {formatHourCompact(hour)}
                              </span>
                            </div>
                          </div>
                        ) : isCurrentHour ? (
                          /* Current hour but not current slot */
                          <div className="w-4 h-4 rounded-full flex items-center justify-center bg-zinc-700">
                            <span className="text-[7px] font-medium leading-none text-zinc-100">
                              {formatHourCompact(hour)}
                            </span>
                          </div>
                        ) : (
                          /* Regular hour label */
                          <span className="text-[8px] text-zinc-500 leading-none">
                            {formatHourCompact(hour)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Breathing dot on current slot - in left gutter area (non-hour slots) */}
                    {isCurrent && !isHourStart && (
                      <div className="absolute left-0 top-0 bottom-0 w-[15%] flex items-center justify-center pointer-events-none z-10">
                        <div className="relative w-4 h-4">
                          <div className="absolute inset-0 rounded-full bg-zinc-800" />
                          <div className="absolute inset-0 rounded-full bg-zinc-100 animate-breathe" />
                        </div>
                      </div>
                    )}

                    {/* Selection overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-blue-500/40 pointer-events-none z-20" />
                    )}
                  </div>
                )
              })}

              {/* Continuous entry blocks rendered on top of the grid */}
              {entryLayout
                .filter(layout => layout.col === col)
                .map(({ entry, startRow, rowSpan, position, maxOverlap }) => {
                  const habit = habits.find(h => h.id === entry.habitId)
                  const color = habit ? (habitDisplayColors.get(habit.id) || '#888') : '#666'

                  // Calculate position as percentage of column
                  const topPercent = (startRow / ROWS) * 100
                  const heightPercent = (rowSpan / ROWS) * 100

                  // Horizontal positioning
                  const leftGutter = 15 // %
                  const availableWidth = 100 - leftGutter - 2 // %
                  const eventWidth = availableWidth / maxOverlap
                  const leftPercent = leftGutter + (position * eventWidth)
                  const widthPercent = eventWidth - (maxOverlap > 1 ? 0.5 : 0)

                  return (
                    <div
                      key={`${entry.id}-${col}`}
                      data-entry={entry.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingEntry(entry.id)
                      }}
                      className="absolute overflow-hidden cursor-pointer hover:brightness-110 transition-all rounded-sm z-10"
                      style={{
                        top: `calc(${topPercent}% + 1px)`,
                        height: `calc(${heightPercent}% - 2px)`,
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                        backgroundColor: color,
                      }}
                    >
                      {/* Entry label at top */}
                      {habit && (
                        <div className="flex items-center gap-0.5 px-1 pt-0.5 overflow-hidden w-full pointer-events-none">
                          {habit.emoji && (
                            <span className="text-[9px] leading-none flex-shrink-0" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))' }}>
                              {habit.emoji}
                            </span>
                          )}
                          <span className="text-[9px] text-white truncate leading-none font-medium">
                            {habit.name}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}

              {/* Timer blocks - rendered on top of the grid, grows from start to current time */}
              {timerLayout
                .filter(layout => layout.col === col)
                .map(({ timer, startRow, rowSpan }) => {
                  const habit = habits.find(h => h.id === timer.habitId)
                  const color = habit ? (habitDisplayColors.get(habit.id) || '#888') : '#666'

                  // Calculate position as percentage of column
                  const topPercent = (startRow / ROWS) * 100
                  const heightPercent = (rowSpan / ROWS) * 100

                  // Full width (no overlap handling for timers)
                  const leftGutter = 15 // %
                  const widthPercent = 100 - leftGutter - 2

                  return (
                    <div
                      key={`${timer.id}-${col}`}
                      className="absolute overflow-hidden rounded-sm z-10 animate-pulse pointer-events-none"
                      style={{
                        top: `calc(${topPercent}% + 1px)`,
                        height: `calc(${heightPercent}% - 2px)`,
                        left: `${leftGutter}%`,
                        width: `${widthPercent}%`,
                        backgroundColor: color,
                        opacity: 0.7,
                      }}
                    >
                      {/* Timer label at top */}
                      {habit && (
                        <div className="flex items-center gap-0.5 px-1 pt-0.5 overflow-hidden w-full">
                          {habit.emoji && (
                            <span className="text-[9px] leading-none flex-shrink-0" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))' }}>
                              {habit.emoji}
                            </span>
                          )}
                          <span className="text-[9px] text-white truncate leading-none font-medium">
                            {habit.name}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar - Quick log */}
      <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-950">
        <div className="px-4 py-2.5">
          {/* Branding */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-600 mb-2">
            <span className="font-medium text-zinc-500">Minimal Habits</span>
            <button
              onClick={onShowAbout}
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

          {/* Legend with filter button */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Center: Habit legend (clickable to open filter) - shows only habits with entries today */}
              <button
                onClick={() => setShowVisibilityDialog(true)}
                className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
              >
                {habitsInView.length > 0 ? (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
                    {habitsInView.map((habit) => {
                      const displayColor = habitDisplayColors.get(habit.id) || '#888'
                      return (
                        <div key={habit.id} className="flex items-center gap-1.5">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: displayColor }}
                          >
                            {habit.emoji && (
                              <span className="text-xs leading-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>{habit.emoji}</span>
                            )}
                          </div>
                          <span className="text-xs text-zinc-400">{habit.name}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : habits.length > 0 ? (
                  <div className="text-center text-xs text-zinc-600">No entries today</div>
                ) : null}
              </button>

              {/* Right: Filter button */}
              {habits.length > 0 && (
                <button
                  onClick={() => setShowVisibilityDialog(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700 transition-colors flex-shrink-0 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                  title="Show / Hide"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Habit selector dialog (for drag selection) */}
      <ResponsiveDialog
        isOpen={showHabitSelector}
        onClose={() => {
          setShowHabitSelector(false)
          setPendingSelection(null)
          setWaitingForHabit(false)
        }}
        title={pendingSelection ? `Log ${formatDuration((toAbsoluteSlot(pendingSelection.endCol, pendingSelection.endRow) - toAbsoluteSlot(pendingSelection.startCol, pendingSelection.startRow) + 1) * 15)}` : 'Select Habit'}
      >
        <div className="px-4 py-4">
          <HabitChipList
            habits={habits}
            groups={groups}
            onSelect={handleSelectHabit}
            onAddHabit={() => {
              setShowHabitSelector(false)
              // Keep pendingSelection and wait for habit to be created
              setWaitingForHabit(true)
              onOpenEditPanel('add-habit')
            }}
          />
        </div>
      </ResponsiveDialog>

      {/* Timer habit selector dialog */}
      <ResponsiveDialog
        isOpen={showTimerHabitSelector}
        onClose={() => setShowTimerHabitSelector(false)}
        title="Start Timer"
      >
        <div className="px-4 py-4">
          {habits.length > 0 && (
            <p className="text-xs text-zinc-500 mb-3">Select a habit to start tracking time</p>
          )}
          <HabitChipList
            habits={habits}
            groups={groups}
            onSelect={handleStartTimer}
            onAddHabit={() => {
              setShowTimerHabitSelector(false)
              onOpenEditPanel('add-habit')
            }}
          />
        </div>
      </ResponsiveDialog>

      {/* Edit entry dialog */}
      <ResponsiveDialog
        isOpen={editingEntry !== null && !showChangeHabit}
        onClose={() => setEditingEntry(null)}
        title="Edit Entry"
      >
        <div className="px-4 py-4">
          {(() => {
            const entry = dayEntries.find(e => e.id === editingEntry)
            const habit = entry ? habits.find(h => h.id === entry.habitId) : null
            const color = habit ? (habitDisplayColors.get(habit.id) || '#888') : '#666'

            if (!entry || !habit) return null

            // Calculate times
            const [startH, startM] = entry.startTime.split(':').map(Number)
            const startMinutes = startH * 60 + startM
            const endMinutes = startMinutes + entry.duration
            const endH = Math.floor(endMinutes / 60) % 24
            const endM = endMinutes % 60

            const formatTime = (h: number, m: number) =>
              `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`

            const adjustStartTime = (delta: number) => {
              const newStartMinutes = Math.max(0, Math.min(24 * 60 - 15, startMinutes + delta))
              const newDuration = Math.max(15, entry.duration - delta)
              const newH = Math.floor(newStartMinutes / 60)
              const newM = newStartMinutes % 60
              onUpdateTimedEntry(entry.id, {
                startTime: formatTime(newH, newM),
                duration: newDuration
              })
            }

            const adjustEndTime = (delta: number) => {
              const newDuration = Math.max(15, entry.duration + delta)
              onUpdateTimedEntry(entry.id, { duration: newDuration })
            }

            return (
              <>
                {/* Habit info - clickable to change */}
                <button
                  onClick={() => setShowChangeHabit(true)}
                  className="w-full flex items-center gap-3 mb-4 pb-4 border-b border-zinc-800 hover:bg-zinc-800/50 -mx-4 px-4 py-2 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {habit.emoji && (
                      <span className="text-xl" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))' }}>{habit.emoji}</span>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-zinc-100">{habit.name}</p>
                    <p className="text-xs text-zinc-500">Tap to change habit</p>
                  </div>
                  <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>

                {/* Start time adjustment */}
                <div className="mb-3">
                  <p className="text-xs text-zinc-500 mb-2">Start time</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjustStartTime(-15)}
                      disabled={startMinutes <= 0}
                      className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-300 text-lg font-medium hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <span className="flex-1 text-center text-base font-medium text-zinc-100 font-mono">
                      {entry.startTime}
                    </span>
                    <button
                      onClick={() => adjustStartTime(15)}
                      disabled={entry.duration <= 15}
                      className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-300 text-lg font-medium hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* End time adjustment */}
                <div className="mb-4">
                  <p className="text-xs text-zinc-500 mb-2">End time</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjustEndTime(-15)}
                      disabled={entry.duration <= 15}
                      className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-300 text-lg font-medium hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <span className="flex-1 text-center text-base font-medium text-zinc-100 font-mono">
                      {formatTime(endH, endM)}
                    </span>
                    <button
                      onClick={() => adjustEndTime(15)}
                      className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-300 text-lg font-medium hover:bg-zinc-700 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Duration display */}
                <div className="text-center text-xs text-zinc-500 mb-4 py-2 bg-zinc-800/50 rounded-lg">
                  {formatDuration(entry.duration)}
                </div>

                {/* Keep running option - only for past entries on today */}
                {isToday && startMinutes < (now.getHours() * 60 + now.getMinutes()) && (
                  <button
                    onClick={() => handleKeepRunning(entry.id)}
                    className="w-full mb-3 py-2.5 px-4 rounded-lg bg-blue-600/20 text-blue-400 text-sm font-medium hover:bg-blue-600/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                    Keep running
                  </button>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingEntry(null)}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition-colors"
                  >
                    Done
                  </button>
                  <button
                    onClick={() => {
                      if (editingEntry) {
                        onDeleteTimedEntry(editingEntry)
                        setEditingEntry(null)
                      }
                    }}
                    className="py-2.5 px-4 rounded-lg bg-red-600/20 text-red-400 text-sm font-medium hover:bg-red-600/30 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </>
            )
          })()}
        </div>
      </ResponsiveDialog>

      {/* Change habit dialog */}
      <ResponsiveDialog
        isOpen={showChangeHabit && editingEntry !== null}
        onClose={() => setShowChangeHabit(false)}
        title="Change Habit"
      >
        <div className="px-4 py-4">
          <HabitChipList
            habits={habits}
            groups={groups}
            onSelect={(habitId) => {
              if (editingEntry) {
                onUpdateTimedEntry(editingEntry, { habitId })
                setShowChangeHabit(false)
              }
            }}
            onAddHabit={() => {
              setShowChangeHabit(false)
              setEditingEntry(null)
              onOpenEditPanel('add-habit')
            }}
          />
        </div>
      </ResponsiveDialog>

      {/* Visibility Dialog */}
      <ResponsiveDialog
        isOpen={showVisibilityDialog}
        onClose={() => setShowVisibilityDialog(false)}
        title="Show / Hide"
      >
        <div className="px-4 py-4">
          {/* Count indicator */}
          <div className="text-xs text-zinc-500 mb-4">
            Showing {visibleCount} of {totalCount} habits
          </div>

          <HabitChipList
            habits={habits}
            groups={groups}
            getIsSelected={getIsSelected}
            getIsDisabled={getIsDisabled}
            onSelect={onToggleVisibility}
            onGroupSelect={onToggleGroupVisibility}
            getIsGroupSelected={getIsGroupSelected}
            showStrikethrough={true}
          />

          {/* Quick actions */}
          {habits.length > 0 && (
            <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-zinc-800">
              <button
                onClick={handleShowAll}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Show all
              </button>
              <span className="text-zinc-700">·</span>
              <button
                onClick={handleHideAll}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Hide all
              </button>
            </div>
          )}
        </div>
      </ResponsiveDialog>
    </div>
  )
}
