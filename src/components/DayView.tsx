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

  // Drag selection state
  const [dragCol, setDragCol] = useState<number | null>(null)
  const [dragStartRow, setDragStartRow] = useState<number | null>(null)
  const [dragEndRow, setDragEndRow] = useState<number | null>(null)
  const isDragging = dragCol !== null && dragStartRow !== null

  // Dialog state
  const [showHabitSelector, setShowHabitSelector] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<{
    col: number
    startRow: number
    endRow: number
  } | null>(null)

  // Timer state
  const [activeTimer, setActiveTimer] = useState<{
    habitId: string
    startTime: string
    startTimestamp: number
    col: number
    row: number
  } | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [showTimerHabitSelector, setShowTimerHabitSelector] = useState(false)

  // Current time (updates every minute for slot highlighting, every second for timer)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), activeTimer ? 1000 : 60000)
    return () => clearInterval(interval)
  }, [activeTimer])

  // Update elapsed seconds when timer is active
  useEffect(() => {
    if (!activeTimer) {
      setElapsedSeconds(0)
      return
    }
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - activeTimer.startTimestamp) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [activeTimer])

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

  // Build a simple slot map just for checking if a slot has entries (for click handling)
  const slotHasEntry = useMemo(() => {
    const set = new Set<string>()
    entryLayout.forEach(({ col, startRow, rowSpan }) => {
      for (let r = startRow; r < startRow + rowSpan; r++) {
        set.add(`${col}:${r}`)
      }
    })
    return set
  }, [entryLayout])

  // Get selected slots during drag (all slots in range, can overlap with existing)
  const selectedSlots = useMemo(() => {
    const set = new Set<string>()
    if (dragCol === null || dragStartRow === null || dragEndRow === null) return set

    const minRow = Math.min(dragStartRow, dragEndRow)
    const maxRow = Math.max(dragStartRow, dragEndRow)

    for (let r = minRow; r <= maxRow; r++) {
      set.add(`${dragCol}:${r}`)
    }

    return set
  }, [dragCol, dragStartRow, dragEndRow])

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

  // Handle pointer down
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Don't handle if timer is active
    if (activeTimer) return

    const slot = getSlotFromPointer(e)
    if (!slot) return

    const { col, row } = slot

    // If this is the current time slot (empty), start timer mode
    const hasEntries = slotHasEntry.has(`${col}:${row}`)

    if (isToday && currentSlot?.col === col && currentSlot?.row === row && !hasEntries) {
      setShowTimerHabitSelector(true)
      return
    }

    // Start drag selection - allow even on occupied slots to add overlapping events
    e.preventDefault()
    gridRef.current?.setPointerCapture(e.pointerId)
    setDragCol(col)
    setDragStartRow(row)
    setDragEndRow(row)
  }, [getSlotFromPointer, slotHasEntry, activeTimer, isToday, currentSlot])

  // Handle pointer move
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return

    const slot = getSlotFromPointer(e)
    if (!slot) return

    // Only update if in same column
    if (slot.col === dragCol) {
      setDragEndRow(slot.row)
    }
  }, [isDragging, dragCol, getSlotFromPointer])

  // Handle pointer up
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (gridRef.current) {
      gridRef.current.releasePointerCapture(e.pointerId)
    }

    if (!isDragging || dragCol === null || dragStartRow === null || dragEndRow === null) {
      setDragCol(null)
      setDragStartRow(null)
      setDragEndRow(null)
      return
    }

    // Check if we have valid selection
    if (selectedSlots.size > 0) {
      const minRow = Math.min(dragStartRow, dragEndRow)
      const maxRow = Math.max(dragStartRow, dragEndRow)

      // Allow adding events even on occupied slots (will create overlaps)
      setPendingSelection({ col: dragCol, startRow: minRow, endRow: maxRow })
      setShowHabitSelector(true)
    }

    setDragCol(null)
    setDragStartRow(null)
    setDragEndRow(null)
  }, [isDragging, dragCol, dragStartRow, dragEndRow, selectedSlots])

  // Handle pointer cancel
  const handlePointerCancel = useCallback(() => {
    setDragCol(null)
    setDragStartRow(null)
    setDragEndRow(null)
  }, [])

  // Handle habit selection from dialog (for drag selection)
  const handleSelectHabit = useCallback((habitId: string) => {
    if (!pendingSelection) return

    const { hour, minute } = slotToTime(pendingSelection.col, pendingSelection.startRow)
    const duration = (pendingSelection.endRow - pendingSelection.startRow + 1) * 15

    onAddTimedEntry(habitId, dateString, formatTimeString(hour, minute), duration)
    onCelebrate()

    setShowHabitSelector(false)
    setPendingSelection(null)
  }, [pendingSelection, dateString, onAddTimedEntry, onCelebrate])

  // Start timer with selected habit
  const handleStartTimer = useCallback((habitId: string) => {
    if (!currentSlot) return

    const { hour, minute } = slotToTime(currentSlot.col, currentSlot.row)
    setActiveTimer({
      habitId,
      startTime: formatTimeString(hour, minute),
      startTimestamp: Date.now(),
      col: currentSlot.col,
      row: currentSlot.row,
    })
    setShowTimerHabitSelector(false)
  }, [currentSlot])

  // Stop timer and save entry
  const handleStopTimer = useCallback(() => {
    if (!activeTimer) return

    // Round up to nearest 15 minutes, minimum 15
    const durationMinutes = Math.max(15, Math.ceil(elapsedSeconds / 60 / 15) * 15)

    onAddTimedEntry(activeTimer.habitId, dateString, activeTimer.startTime, durationMinutes)
    onCelebrate()

    setActiveTimer(null)
    setElapsedSeconds(0)
  }, [activeTimer, elapsedSeconds, dateString, onAddTimedEntry, onCelebrate])

  // Navigation
  const goToPrevDay = () => onDateChange(subDays(date, 1))
  const goToNextDay = () => onDateChange(addDays(date, 1))
  const goToToday = () => onDateChange(new Date())


  // Get active timer habit info
  const activeHabit = activeTimer ? habits.find(h => h.id === activeTimer.habitId) : null
  const activeColor = activeHabit ? (habitDisplayColors.get(activeHabit.id) || activeHabit.color) : undefined

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPrevDay}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          <div className="text-center">
            <button
              onClick={goToToday}
              className={`text-lg font-medium ${isToday ? 'text-zinc-100' : 'text-zinc-300 hover:text-zinc-100'}`}
            >
              {isToday ? 'Today' : format(date, 'EEEE')}
            </button>
            <p className="text-sm text-zinc-500">{format(date, 'MMMM d, yyyy')}</p>
          </div>

          <button
            onClick={goToNextDay}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Active timer bar */}
      {activeTimer && activeHabit && (
        <div
          className="flex-shrink-0 px-4 py-2 border-b border-zinc-800 flex items-center gap-3"
          style={{ backgroundColor: activeColor + '20' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: activeColor }}
          >
            {activeHabit.emoji && (
              <span className="text-lg" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))' }}>{activeHabit.emoji}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-100 truncate">{activeHabit.name}</p>
            <p className="text-xs text-zinc-500">Recording...</p>
          </div>
          <span className="font-mono text-xl text-zinc-100 tabular-nums">
            {formatElapsed(elapsedSeconds)}
          </span>
          <button
            onClick={handleStopTimer}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Stop
          </button>
        </div>
      )}

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
                const isCurrent = currentSlot?.col === col && currentSlot?.row === row && !activeTimer
                const isCurrentHour = isHourStart && currentSlot?.col === col && Math.floor(currentSlot?.row / SLOTS_PER_HOUR) === Math.floor(row / SLOTS_PER_HOUR)
                const isTimerSlot = activeTimer?.col === col && activeTimer?.row === row
                const { hour } = slotToTime(col, row)

                return (
                  <div
                    key={row}
                    data-col={col}
                    data-row={row}
                    className={`
                      flex-1 relative select-none
                      ${isHourStart ? 'border-t border-zinc-700/50' : 'border-t border-zinc-800/30'}
                      ${isCurrent ? 'bg-zinc-800/50' : ''}
                      ${isTimerSlot ? 'ring-2 ring-inset ring-zinc-400 bg-zinc-700/50' : ''}
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

                    {/* Timer slot indicator */}
                    {isTimerSlot && activeHabit && (
                      <div className="absolute left-[15%] right-0 top-0 bottom-0 flex items-center gap-0.5 px-0.5 overflow-hidden pointer-events-none">
                        <span className="text-[9px] leading-none flex-shrink-0 w-3 text-center" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))' }}>
                          {activeHabit.emoji || ''}
                        </span>
                        <span className="text-[9px] text-white truncate leading-none font-medium">
                          {activeHabit.name}
                        </span>
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
        title={pendingSelection ? `Log ${(pendingSelection.endRow - pendingSelection.startRow + 1) * 15} min` : 'Select Habit'}
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
        isOpen={editingEntry !== null}
        onClose={() => setEditingEntry(null)}
        title="Edit Entry"
      >
        <div className="px-4 py-4">
          {(() => {
            const entry = dayEntries.find(e => e.id === editingEntry)
            const habit = entry ? habits.find(h => h.id === entry.habitId) : null
            const color = habit ? (habitDisplayColors.get(habit.id) || habit.color) : '#666'

            if (!entry || !habit) return null

            // Calculate end time
            const [startH, startM] = entry.startTime.split(':').map(Number)
            const endMinutes = startH * 60 + startM + entry.duration
            const endH = Math.floor(endMinutes / 60) % 24
            const endM = endMinutes % 60
            const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`

            return (
              <>
                {/* Entry info */}
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-zinc-800">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {habit.emoji && (
                      <span className="text-2xl" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))' }}>{habit.emoji}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-medium text-zinc-100">{habit.name}</p>
                    <p className="text-sm text-zinc-400">
                      {entry.startTime} - {endTime}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {entry.duration} minutes
                    </p>
                  </div>
                </div>

                {/* Duration adjustment */}
                <div className="mb-4">
                  <p className="text-xs text-zinc-500 mb-2">Adjust duration</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (entry.duration > 15) {
                          onUpdateTimedEntry(entry.id, { duration: entry.duration - 15 })
                        }
                      }}
                      disabled={entry.duration <= 15}
                      className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-300 text-lg font-medium hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <span className="flex-1 text-center text-lg font-medium text-zinc-100">
                      {entry.duration} min
                    </span>
                    <button
                      onClick={() => {
                        onUpdateTimedEntry(entry.id, { duration: entry.duration + 15 })
                      }}
                      className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-300 text-lg font-medium hover:bg-zinc-700 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingEntry(null)}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors"
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
    </div>
  )
}
