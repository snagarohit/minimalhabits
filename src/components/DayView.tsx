import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { format, addDays, subDays } from 'date-fns'
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
  onDateChange: (date: Date) => void
  onAddTimedEntry: (habitId: string, date: string, startTime: string, duration: number) => TimedEntry
  onUpdateTimedEntry: (id: string, updates: Partial<Omit<TimedEntry, 'id'>>) => void
  onDeleteTimedEntry: (id: string) => void
  onToggleCompletion: (habitId: string, date: string) => void
  onCelebrate: () => void
  onOpenEditPanel: () => void
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

export function DayView({
  date,
  habits,
  groups,
  timedEntries,
  completions: _completions,
  habitDisplayColors,
  onDateChange,
  onAddTimedEntry,
  onUpdateTimedEntry,
  onDeleteTimedEntry,
  onToggleCompletion: _onToggleCompletion,
  onCelebrate,
  onOpenEditPanel,
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

  // Timer state - supports multiple simultaneous timers
  const [activeTimers, setActiveTimers] = useState<Array<{
    id: string
    habitId: string
    startTime: string
    startTimestamp: number
    col: number
    row: number
  }>>([])
  const [timerTick, setTimerTick] = useState(0) // Forces re-render for elapsed time
  const [showTimerHabitSelector, setShowTimerHabitSelector] = useState(false)

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

  const isToday = format(now, 'yyyy-MM-dd') === dateString
  const currentSlot = useMemo(() => {
    if (!isToday) return null
    return timeToSlot(now.getHours(), now.getMinutes())
  }, [isToday, now])

  // Get entries for this day
  const dayEntries = useMemo(() => {
    return timedEntries.filter(e => e.date === dateString)
  }, [timedEntries, dateString])

  // Compute entry layout info for continuous block rendering
  // Each entry gets: column, startRow, rowSpan, and horizontal position based on overlaps
  const entryLayout = useMemo(() => {
    // First, compute the slots each entry occupies
    const entrySlots = dayEntries.map(entry => {
      const [h, m] = entry.startTime.split(':').map(Number)
      const start = timeToSlot(h, m)
      if (!start) return { entry, col: -1, startRow: -1, rowSpan: 0 }

      const numSlots = Math.ceil(entry.duration / 15)
      // For now, entries stay within their starting column
      const rowSpan = Math.min(numSlots, ROWS - start.row)

      return { entry, col: start.col, startRow: start.row, rowSpan }
    }).filter(e => e.col >= 0)

    // For each slot, find which entries occupy it
    const slotToEntryIds = new Map<string, Set<string>>()

    entrySlots.forEach(({ entry, col, startRow, rowSpan }) => {
      for (let r = startRow; r < startRow + rowSpan; r++) {
        const key = `${col}:${r}`
        if (!slotToEntryIds.has(key)) slotToEntryIds.set(key, new Set())
        slotToEntryIds.get(key)!.add(entry.id)
      }
    })

    // For each entry, find its maximum overlap count and consistent position
    // We need to find the maximum number of overlapping entries across all its slots
    // and assign a consistent horizontal position
    const entryMaxOverlap = new Map<string, number>()
    const entryPosition = new Map<string, number>()

    entrySlots.forEach(({ entry, col, startRow, rowSpan }) => {
      let maxOverlap = 1
      for (let r = startRow; r < startRow + rowSpan; r++) {
        const key = `${col}:${r}`
        const count = slotToEntryIds.get(key)?.size || 1
        maxOverlap = Math.max(maxOverlap, count)
      }
      entryMaxOverlap.set(entry.id, maxOverlap)
    })

    // Assign positions - group overlapping entries and assign consistent positions
    // Process column by column, row by row
    for (let col = 0; col < COLUMNS; col++) {
      const processed = new Set<string>()

      for (let row = 0; row < ROWS; row++) {
        const key = `${col}:${row}`
        const entryIds = slotToEntryIds.get(key)
        if (!entryIds) continue

        // Sort entries by start time for consistent ordering
        const sortedIds = Array.from(entryIds).sort((aId, bId) => {
          const aEntry = dayEntries.find(e => e.id === aId)!
          const bEntry = dayEntries.find(e => e.id === bId)!
          const [ah, am] = aEntry.startTime.split(':').map(Number)
          const [bh, bm] = bEntry.startTime.split(':').map(Number)
          return ah * 60 + am - (bh * 60 + bm)
        })

        // Assign positions to entries that haven't been positioned yet
        const usedPositions = new Set<number>()
        sortedIds.forEach(id => {
          if (entryPosition.has(id)) {
            usedPositions.add(entryPosition.get(id)!)
          }
        })

        sortedIds.forEach((id) => {
          if (!processed.has(id)) {
            // Find first available position
            let pos = 0
            while (usedPositions.has(pos)) pos++
            entryPosition.set(id, pos)
            usedPositions.add(pos)
            processed.add(id)
          }
        })
      }
    }

    // Build final layout
    return entrySlots.map(({ entry, col, startRow, rowSpan }) => ({
      entry,
      col,
      startRow,
      rowSpan,
      position: entryPosition.get(entry.id) || 0,
      maxOverlap: entryMaxOverlap.get(entry.id) || 1
    }))
  }, [dayEntries])

  // Convert col/row to absolute slot index (0 to COLUMNS*ROWS-1)
  const toAbsoluteSlot = useCallback((col: number, row: number) => col * ROWS + row, [])
  const fromAbsoluteSlot = useCallback((slot: number) => ({
    col: Math.floor(slot / ROWS),
    row: slot % ROWS
  }), [])

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

  // Navigation
  const goToPrevDay = () => onDateChange(subDays(date, 1))
  const goToNextDay = () => onDateChange(addDays(date, 1))
  const goToToday = () => onDateChange(new Date())

  // Get timer info helpers
  const getTimerHabit = useCallback((timer: typeof activeTimers[0]) => {
    return habits.find(h => h.id === timer.habitId)
  }, [habits])

  const getTimerColor = useCallback((timer: typeof activeTimers[0]) => {
    const habit = getTimerHabit(timer)
    return habit ? (habitDisplayColors.get(habit.id) || habit.color) : '#666'
  }, [getTimerHabit, habitDisplayColors])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-zinc-800 px-3 py-1.5">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPrevDay}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          <button
            onClick={goToToday}
            className="flex items-center gap-2 hover:bg-zinc-800/50 px-2 py-1 rounded-lg transition-colors"
          >
            <span className={`text-sm font-medium ${isToday ? 'text-zinc-100' : 'text-zinc-300'}`}>
              {isToday ? 'Today' : format(date, 'EEE')}
            </span>
            <span className="text-xs text-zinc-500">{format(date, 'MMM d')}</span>
          </button>

          <button
            onClick={goToNextDay}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

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
                const timersAtSlot = activeTimers.filter(t => t.col === col && t.row === row)
                const hasTimer = timersAtSlot.length > 0
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
                      ${isCurrent && !hasTimer ? 'bg-zinc-800/50' : ''}
                      ${hasTimer ? 'ring-2 ring-inset ring-zinc-400 bg-zinc-700/50' : ''}
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

                    {/* Timer slot indicators */}
                    {hasTimer && (
                      <div className="absolute left-[15%] right-0 top-0 bottom-0 flex items-center gap-1 px-0.5 overflow-hidden pointer-events-none">
                        {timersAtSlot.map(timer => {
                          const timerHabit = getTimerHabit(timer)
                          if (!timerHabit) return null
                          return (
                            <div key={timer.id} className="flex items-center gap-0.5 min-w-0">
                              <span className="text-[9px] leading-none flex-shrink-0" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))' }}>
                                {timerHabit.emoji || ''}
                              </span>
                              <span className="text-[9px] text-white truncate leading-none font-medium">
                                {timerHabit.name}
                              </span>
                            </div>
                          )
                        })}
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
                  const color = habit ? (habitDisplayColors.get(habit.id) || habit.color) : '#666'

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
                      key={entry.id}
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
              onClick={onOpenEditPanel}
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

          {/* Legend - only habits that have entries today */}
          <div className="flex-1 min-w-0">
            {dayEntries.length > 0 ? (
              <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
                {/* Get unique habits that have entries today */}
                {Array.from(new Set(dayEntries.map(e => e.habitId))).map((habitId) => {
                  const habit = habits.find(h => h.id === habitId)
                  if (!habit) return null
                  const color = habitDisplayColors.get(habit.id) || habit.color
                  return (
                    <div key={habit.id} className="flex items-center gap-1.5">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {habit.emoji && (
                          <span className="text-xs leading-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))' }}>{habit.emoji}</span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400">{habit.name}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center text-xs text-zinc-600">No entries today</div>
            )}
          </div>
        </div>
      </div>

      {/* Habit selector dialog (for drag selection) */}
      <ResponsiveDialog
        isOpen={showHabitSelector}
        onClose={() => {
          setShowHabitSelector(false)
          setPendingSelection(null)
        }}
        title={pendingSelection ? `Log ${(toAbsoluteSlot(pendingSelection.endCol, pendingSelection.endRow) - toAbsoluteSlot(pendingSelection.startCol, pendingSelection.startRow) + 1) * 15} min` : 'Select Habit'}
      >
        <div className="px-4 py-4">
          <HabitChipList
            habits={habits}
            groups={groups}
            onSelect={handleSelectHabit}
            emptyMessage="No habits yet"
            emptySubMessage="Tap below to add your first habit"
            onAddHabit={() => {
              setShowHabitSelector(false)
              setPendingSelection(null)
              onOpenEditPanel()
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
          <p className="text-xs text-zinc-500 mb-3">Select a habit to start tracking time</p>
          <HabitChipList
            habits={habits}
            groups={groups}
            onSelect={handleStartTimer}
            emptyMessage="No habits yet"
            emptySubMessage="Tap below to add your first habit"
            onAddHabit={() => {
              setShowTimerHabitSelector(false)
              onOpenEditPanel()
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
            const color = habit ? (habitDisplayColors.get(habit.id) || habit.color) : '#666'

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
                  {entry.duration} minutes
                </div>

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
            emptyMessage="No habits yet"
            emptySubMessage="Tap below to add your first habit"
            onAddHabit={() => {
              setShowChangeHabit(false)
              setEditingEntry(null)
              onOpenEditPanel()
            }}
          />
        </div>
      </ResponsiveDialog>
    </div>
  )
}
