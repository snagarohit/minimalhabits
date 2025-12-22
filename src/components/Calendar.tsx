import { useMemo, useCallback, useRef, useEffect } from 'react'
import {
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  format,
  isToday as checkIsToday,
  isSameMonth,
  isWeekend,
} from 'date-fns'
import { DayCell } from './DayCell'
import type { Habit, DayData } from '../types'

export type ViewMode = 'month' | 'workweek' | 'day'

interface CalendarProps {
  habits: Habit[]
  habitDisplayColors: Map<string, string>
  getCompletionValue: (habitId: string, date: string) => number
  onDayClick: (dateString: string) => void
  onMonthChange?: (date: Date) => void
  onVisibleDatesChange?: (dates: string[]) => void
  viewMode: ViewMode
  currentDate: Date
}

export function Calendar({
  habits,
  habitDisplayColors,
  getCompletionValue,
  onDayClick,
  onMonthChange,
  onVisibleDatesChange,
  viewMode,
  currentDate,
}: CalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)
  const lastReportedMonthRef = useRef<string>(format(currentDate, 'yyyy-MM'))
  const lastReportedDatesRef = useRef<string>('')
  const touchStartRef = useRef<{ y: number; scrollTop: number } | null>(null)
  const scrollEndTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Number of weeks to show before and after the current month
  const WEEKS_BEFORE = 4
  const WEEKS_AFTER = 4

  // Generate all weeks: past weeks + current month + future weeks
  const { allWeeks, initialScrollIndex } = useMemo(() => {
    const today = new Date()
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)

    // Find the first week that contains a day from this month
    const firstMonthWeek = startOfWeek(monthStart, { weekStartsOn: 0 })
    // Find the last week that contains a day from this month
    const lastMonthWeek = startOfWeek(monthEnd, { weekStartsOn: 0 })
    // Find the week containing today
    const todayWeek = startOfWeek(today, { weekStartsOn: 0 })

    // Calculate total weeks to generate
    const weeksInMonth = Math.ceil(
      (lastMonthWeek.getTime() - firstMonthWeek.getTime()) / (7 * 24 * 60 * 60 * 1000)
    ) + 1
    const totalWeeks = WEEKS_BEFORE + weeksInMonth + WEEKS_AFTER

    const weeks: DayData[][] = []
    let firstMonthWeekIndex = WEEKS_BEFORE
    let todayWeekIndex = -1

    for (let weekNum = 0; weekNum < totalWeeks; weekNum++) {
      // Calculate the start of this week
      const weekOffset = weekNum - WEEKS_BEFORE
      const weekStartDate = addWeeks(firstMonthWeek, weekOffset)

      // Track the week containing today
      if (weekStartDate.getTime() === todayWeek.getTime()) {
        todayWeekIndex = weekNum
      }

      const weekDays: DayData[] = []
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = addDays(weekStartDate, dayOffset)
        weekDays.push({
          date,
          dateString: format(date, 'yyyy-MM-dd'),
          dayOfMonth: date.getDate(),
          isToday: checkIsToday(date),
          isCurrentMonth: isSameMonth(date, currentDate),
          month: date.getMonth(),
          year: date.getFullYear(),
        })
      }

      weeks.push(weekDays)
    }

    // Determine scroll position:
    // - Default to first week of month
    // - But if today is within this month AND more than 4 weeks after first week, scroll to show today
    let scrollToIndex = firstMonthWeekIndex

    // Only adjust for today if today is actually in the current viewing month
    const todayIsInViewingMonth = isSameMonth(today, currentDate)
    if (todayIsInViewingMonth && todayWeekIndex >= 0 && todayWeekIndex > firstMonthWeekIndex + 4) {
      scrollToIndex = Math.max(0, todayWeekIndex - 2)
    }

    return { allWeeks: weeks, initialScrollIndex: scrollToIndex }
  }, [currentDate])

  // Scroll to the first week of the current month on mount/date change
  useEffect(() => {
    if (scrollRef.current) {
      isScrollingRef.current = true
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          const weekHeight = scrollRef.current.clientHeight / 5 // Each week is 1/5 of container
          const targetScroll = initialScrollIndex * weekHeight
          // Force scroll reset
          scrollRef.current.scrollTo({
            top: targetScroll,
            behavior: 'instant'
          })
          // Report initial visible dates
          if (onVisibleDatesChange) {
            const topWeekIndex = initialScrollIndex
            const visibleDates: string[] = []
            for (let i = 0; i < 5; i++) {
              const weekIndex = topWeekIndex + i
              if (weekIndex >= 0 && weekIndex < allWeeks.length) {
                for (const day of allWeeks[weekIndex]) {
                  visibleDates.push(day.dateString)
                }
              }
            }
            lastReportedDatesRef.current = visibleDates.join(',')
            onVisibleDatesChange(visibleDates)
          }
          setTimeout(() => {
            isScrollingRef.current = false
          }, 100)
        }
      })
    }
  }, [initialScrollIndex, currentDate, allWeeks, onVisibleDatesChange])

  // Update month based on visible weeks
  const updateVisibleMonth = useCallback((scrollTop: number) => {
    if (!scrollRef.current || !onMonthChange) return

    const container = scrollRef.current
    const weekHeight = container.clientHeight / 5
    const topWeekIndex = Math.round(scrollTop / weekHeight)

    // Look at the middle week of the visible 5 weeks to determine the month
    const middleWeekIndex = topWeekIndex + 2
    if (middleWeekIndex >= 0 && middleWeekIndex < allWeeks.length) {
      const middleWeek = allWeeks[middleWeekIndex]
      const monthCounts = new Map<string, { count: number; date: Date }>()

      for (const day of middleWeek) {
        const monthKey = format(day.date, 'yyyy-MM')
        const existing = monthCounts.get(monthKey)
        if (existing) {
          existing.count++
        } else {
          monthCounts.set(monthKey, { count: 1, date: day.date })
        }
      }

      let dominantMonth = ''
      let maxCount = 0
      for (const [monthKey, { count }] of monthCounts) {
        if (count > maxCount) {
          maxCount = count
          dominantMonth = monthKey
        }
      }

      if (dominantMonth && dominantMonth !== lastReportedMonthRef.current) {
        lastReportedMonthRef.current = dominantMonth
        const monthData = monthCounts.get(dominantMonth)
        if (monthData) {
          onMonthChange(startOfMonth(monthData.date))
        }
      }
    }
  }, [allWeeks, onMonthChange])

  // Report visible dates (all dates in the 5 visible weeks)
  const updateVisibleDates = useCallback((scrollTop: number) => {
    if (!scrollRef.current || !onVisibleDatesChange) return

    const container = scrollRef.current
    const weekHeight = container.clientHeight / 5
    const topWeekIndex = Math.round(scrollTop / weekHeight)

    // Collect all dates from the 5 visible weeks
    const visibleDates: string[] = []
    for (let i = 0; i < 5; i++) {
      const weekIndex = topWeekIndex + i
      if (weekIndex >= 0 && weekIndex < allWeeks.length) {
        for (const day of allWeeks[weekIndex]) {
          visibleDates.push(day.dateString)
        }
      }
    }

    // Only report if dates changed
    const datesKey = visibleDates.join(',')
    if (datesKey !== lastReportedDatesRef.current) {
      lastReportedDatesRef.current = datesKey
      onVisibleDatesChange(visibleDates)
    }
  }, [allWeeks, onVisibleDatesChange])

  // Custom touch handlers for controlled scrolling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!scrollRef.current) return
    touchStartRef.current = {
      y: e.touches[0].clientY,
      scrollTop: scrollRef.current.scrollTop
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!scrollRef.current || !touchStartRef.current) return
    e.preventDefault() // Prevent native scrolling

    const container = scrollRef.current
    const deltaY = touchStartRef.current.y - e.touches[0].clientY
    const newScrollTop = touchStartRef.current.scrollTop + deltaY

    // Clamp to valid scroll range
    const maxScroll = container.scrollHeight - container.clientHeight
    container.scrollTop = Math.max(0, Math.min(maxScroll, newScrollTop))
  }, [])

  // Snap to nearest week
  const snapToNearestWeek = useCallback(() => {
    if (!scrollRef.current || isScrollingRef.current) return

    const container = scrollRef.current
    const weekHeight = container.clientHeight / 5
    const currentScroll = container.scrollTop
    const nearestWeekIndex = Math.round(currentScroll / weekHeight)
    const targetScroll = nearestWeekIndex * weekHeight

    // Only snap if not already at target
    if (Math.abs(currentScroll - targetScroll) < 1) return

    // Animate to snap position
    isScrollingRef.current = true
    container.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    })

    // Update after snap
    setTimeout(() => {
      isScrollingRef.current = false
      updateVisibleMonth(targetScroll)
      updateVisibleDates(targetScroll)
    }, 300)
  }, [updateVisibleMonth, updateVisibleDates])

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null
    snapToNearestWeek()
  }, [snapToNearestWeek])

  // Handle scroll events (for mouse/trackpad) - snap after scroll stops
  const handleScroll = useCallback(() => {
    if (isScrollingRef.current) return

    // Clear existing timeout
    if (scrollEndTimeoutRef.current) {
      clearTimeout(scrollEndTimeoutRef.current)
    }

    // Set timeout to snap after scrolling stops
    scrollEndTimeoutRef.current = setTimeout(() => {
      snapToNearestWeek()
    }, 150)
  }, [snapToNearestWeek])

  // Get completion data for a day
  const getDayCompletions = useCallback(
    (dateString: string) => {
      return habits.map((habit) => {
        const value = getCompletionValue(habit.id, dateString)
        return { habit, value, isComplete: value > 0 }
      })
    },
    [habits, getCompletionValue]
  )

  // Filter days for workweek mode
  const getDaysForView = (weekDays: DayData[]) => {
    if (viewMode === 'workweek') {
      return weekDays.filter(day => !isWeekend(day.date))
    }
    return weekDays
  }

  const isVertical = viewMode === 'workweek'

  if (!isVertical) {
    return (
      <div className="flex h-full flex-col">
        {/* Day headers */}
        <div className="grid grid-cols-7 px-2 py-2 border-b border-zinc-800 flex-shrink-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-zinc-500">
              {day}
            </div>
          ))}
        </div>

        {/* Scrollable calendar - each week is 1/5 of container height, snaps to weeks */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="flex-1 overflow-y-auto scrollbar-hide bg-zinc-800/50 touch-none"
        >
          {allWeeks.map((week, weekIndex) => (
            <div
              key={weekIndex}
              className="grid grid-cols-7 gap-px p-px"
              style={{ height: '20%' }}
            >
              {week.map((day) => (
                <div key={day.dateString} className="bg-zinc-950 min-h-0">
                  <DayCell
                    day={day}
                    completions={getDayCompletions(day.dateString)}
                    totalHabits={habits.length}
                    habitDisplayColors={habitDisplayColors}
                    onClick={() => onDayClick(day.dateString)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        <style>{`
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
      </div>
    )
  }

  // Workweek view: vertical stack of current week's weekdays
  const currentWeek = allWeeks.find(week =>
    week.some(day => day.isToday)
  ) || allWeeks[initialScrollIndex] || allWeeks[0]

  const weekdays = currentWeek ? getDaysForView(currentWeek) : []

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex-1 grid gap-px bg-zinc-800/50 p-px"
        style={{ gridTemplateRows: `repeat(${weekdays.length}, 1fr)` }}
      >
        {weekdays.map((day) => (
          <button
            key={day.dateString}
            onClick={() => onDayClick(day.dateString)}
            className="bg-zinc-950 min-h-0 w-full text-left transition-colors hover:bg-zinc-800 active:bg-zinc-700"
          >
            <DayCellVertical
              day={day}
              completions={getDayCompletions(day.dateString)}
              totalHabits={habits.length}
              habitDisplayColors={habitDisplayColors}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

// Vertical day cell for week/workweek view
interface DayCellVerticalProps {
  day: DayData
  completions: { habit: Habit; value: number; isComplete: boolean }[]
  totalHabits: number
  habitDisplayColors: Map<string, string>
}

// Max visible habits in vertical view before showing +X badge
const MAX_VISIBLE_HABITS_VERTICAL = 8

function DayCellVertical({ day, completions, totalHabits: _totalHabits, habitDisplayColors }: DayCellVerticalProps) {
  const isCurrentMonth = day.isCurrentMonth
  const isToday = day.isToday

  const completedHabits = completions.filter(c => c.isComplete)

  // Calculate overflow - only show badge if 2+ items hidden
  // If only 1 item would be hidden, just show all items instead of "+1" badge
  const overflowCount = completedHabits.length - MAX_VISIBLE_HABITS_VERTICAL
  const showOverflowBadge = overflowCount > 1
  const visibleHabits = showOverflowBadge
    ? completedHabits.slice(0, MAX_VISIBLE_HABITS_VERTICAL)
    : completedHabits

  return (
    <div
      className={`
        relative w-full h-full flex items-center gap-3 px-3
        ${isCurrentMonth ? '' : 'opacity-35'}
      `}
    >
      {/* Date section */}
      <div className="flex flex-col items-center w-12 flex-shrink-0">
        <span className="text-xs text-zinc-500 uppercase">
          {format(day.date, 'EEE')}
        </span>
        <span
          className={`
            text-lg tabular-nums font-medium leading-none mt-1
            ${isToday
              ? 'flex items-center justify-center w-8 h-8 rounded-full bg-white text-black'
              : isCurrentMonth
                ? 'text-zinc-200'
                : 'text-zinc-500'
            }
          `}
        >
          {day.dayOfMonth}
        </span>
      </div>

      {/* Dots flowing horizontally with wrap - responsive sizes */}
      <div className="flex-1 flex flex-wrap items-center gap-1.5 sm:gap-2 overflow-hidden">
        {visibleHabits.map(({ habit }) => {
          const color = habitDisplayColors.get(habit.id) || '#888'
          return (
            <div
              key={habit.id}
              className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: color }}
            >
              {habit.emoji && (
                <span className="text-base sm:text-xl leading-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>{habit.emoji}</span>
              )}
            </div>
          )
        })}

        {/* Overflow dot - only shown if 2+ items hidden */}
        {showOverflowBadge && (
          <div
            className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-zinc-700 border border-zinc-600"
            title={`+${overflowCount} more`}
          >
            <span className="text-[10px] sm:text-xs font-medium text-zinc-300 leading-none">+{overflowCount}</span>
          </div>
        )}
      </div>
    </div>
  )
}
