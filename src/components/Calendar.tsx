import { useMemo, useCallback, useRef, useEffect } from 'react'
import {
  startOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  addDays,
  eachWeekOfInterval,
  format,
  isToday,
  isSameMonth,
  isBefore,
  isWeekend,
} from 'date-fns'
import { DayCell } from './DayCell'
import type { Habit, DayData } from '../types'

export type ViewMode = 'month' | 'week' | 'workweek' | 'day'

interface CalendarProps {
  habits: Habit[]
  habitDisplayColors: Map<string, string>
  getCompletionValue: (habitId: string, date: string) => number
  onDayClick: (dateString: string) => void
  viewMode: ViewMode
}

export function Calendar({
  habits,
  habitDisplayColors,
  getCompletionValue,
  onDayClick,
  viewMode,
}: CalendarProps) {
  const today = new Date()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Generate weeks: 12 weeks before current month + all weeks of current month
  const { weeks, firstCurrentMonthWeekIndex, currentWeekIndex } = useMemo(() => {
    const monthStart = startOfMonth(today)
    const monthEnd = endOfMonth(today)

    // Get all weeks that contain days from current month
    const currentMonthWeekStarts = eachWeekOfInterval(
      { start: monthStart, end: monthEnd },
      { weekStartsOn: 0 }
    )

    // Go back 12 weeks from the first week of current month
    const firstMonthWeek = currentMonthWeekStarts[0]
    const earliestWeek = subWeeks(firstMonthWeek, 12)

    // Build all weeks from earliest to end of current month
    const weekGroups: DayData[][] = []
    let currentWeek = startOfWeek(earliestWeek, { weekStartsOn: 0 })
    const lastWeek = currentMonthWeekStarts[currentMonthWeekStarts.length - 1]
    const todayWeekStart = startOfWeek(today, { weekStartsOn: 0 })

    let firstCurrentMonthIdx = 0
    let currentWeekIdx = 0
    let weekIdx = 0

    while (!isBefore(lastWeek, currentWeek)) {
      const weekDays: DayData[] = []

      // Check if this week is the first week of current month
      if (currentWeek.getTime() === firstMonthWeek.getTime()) {
        firstCurrentMonthIdx = weekIdx
      }

      // Check if this is the current week
      if (currentWeek.getTime() === todayWeekStart.getTime()) {
        currentWeekIdx = weekIdx
      }

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = addDays(currentWeek, dayOffset)
        weekDays.push({
          date,
          dateString: format(date, 'yyyy-MM-dd'),
          dayOfMonth: date.getDate(),
          isToday: isToday(date),
          isCurrentMonth: isSameMonth(date, today),
          month: date.getMonth(),
          year: date.getFullYear(),
        })
      }

      weekGroups.push(weekDays)
      currentWeek = addDays(currentWeek, 7)
      weekIdx++
    }

    return {
      weeks: weekGroups,
      firstCurrentMonthWeekIndex: firstCurrentMonthIdx,
      currentWeekIndex: currentWeekIdx
    }
  }, [today])

  // Scroll to appropriate position based on view mode
  useEffect(() => {
    if (scrollRef.current) {
      const weekElements = scrollRef.current.querySelectorAll('[data-week]')
      // For month view, scroll to first week of month; for week/workweek, scroll to current week
      const targetIndex = viewMode === 'month' ? firstCurrentMonthWeekIndex : currentWeekIndex
      if (weekElements[targetIndex]) {
        weekElements[targetIndex].scrollIntoView({ block: 'start' })
      }
    }
  }, [firstCurrentMonthWeekIndex, currentWeekIndex, viewMode])

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

  const isVertical = viewMode === 'week' || viewMode === 'workweek'

  // Month view: horizontal grid
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

        {/* Scrollable calendar with snap */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto snap-y snap-mandatory scrollbar-hide"
        >
          <div className="flex flex-col gap-px bg-zinc-800/50 p-px">
            {weeks.map((week, weekIndex) => (
              <div
                key={weekIndex}
                data-week={weekIndex}
                className="grid grid-cols-7 gap-px snap-start"
                style={{ height: 'calc((100vh - 180px) / 5)' }}
              >
                {week.map((day) => (
                  <div key={day.dateString} className="bg-zinc-950 h-full">
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
        </div>

        <style>{`
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
      </div>
    )
  }

  // Week/Workweek view: vertical stack
  const daysCount = viewMode === 'workweek' ? 5 : 7
  return (
    <div className="flex h-full flex-col">
      {/* Scrollable vertical weeks */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto snap-y snap-mandatory scrollbar-hide"
      >
        <div className="flex flex-col gap-px bg-zinc-800/50 p-px">
          {weeks.map((week, weekIndex) => {
            const daysToShow = getDaysForView(week)
            return (
              <div
                key={weekIndex}
                data-week={weekIndex}
                className="flex flex-col gap-px snap-start"
                style={{ minHeight: 'calc(100vh - 140px)' }}
              >
                {daysToShow.map((day) => (
                  <button
                    key={day.dateString}
                    onClick={() => onDayClick(day.dateString)}
                    className="bg-zinc-950 flex-1 min-h-0 w-full text-left transition-colors hover:bg-zinc-800 active:bg-zinc-700"
                    style={{ height: `calc((100vh - 140px) / ${daysCount})` }}
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
            )
          })}
        </div>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
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

function DayCellVertical({ day, completions, totalHabits: _totalHabits, habitDisplayColors }: DayCellVerticalProps) {
  const isCurrentMonth = day.isCurrentMonth
  const isToday = day.isToday

  const completedHabits = completions.filter(c => c.isComplete)

  return (
    <div
      className={`
        w-full h-full flex items-center gap-3 px-3
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
        {completedHabits.map(({ habit }) => {
          const color = habitDisplayColors.get(habit.id) || habit.color
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
      </div>
    </div>
  )
}
