import { memo, useRef, useState, useLayoutEffect } from 'react'
import type { DayData, Habit } from '../types'

interface HabitCompletion {
  habit: Habit
  value: number
  isComplete: boolean
}

interface DayCellProps {
  day: DayData
  completions: HabitCompletion[]
  totalHabits: number
  habitDisplayColors: Map<string, string>
  onClick: () => void
}

// Dot sizes and gaps (must match CSS)
const DOT_SIZE_MOBILE = 20 // w-5 = 1.25rem = 20px
const DOT_SIZE_DESKTOP = 28 // w-7 = 1.75rem = 28px
const GAP_MOBILE = 4 // gap-1 = 0.25rem = 4px
const GAP_DESKTOP = 6 // gap-1.5 = 0.375rem = 6px

export const DayCell = memo(function DayCell({
  day,
  completions,
  totalHabits: _totalHabits,
  habitDisplayColors,
  onClick,
}: DayCellProps) {
  const isCurrentMonth = day.isCurrentMonth
  const isToday = day.isToday
  const containerRef = useRef<HTMLDivElement>(null)
  const [maxVisible, setMaxVisible] = useState(6) // Default fallback

  // Calculate how many dots can fit
  useLayoutEffect(() => {
    const calculateMax = () => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const isDesktop = window.innerWidth >= 640 // sm breakpoint

      const dotSize = isDesktop ? DOT_SIZE_DESKTOP : DOT_SIZE_MOBILE
      const gap = isDesktop ? GAP_DESKTOP : GAP_MOBILE

      // Calculate how many dots fit per row and how many rows fit
      const dotsPerRow = Math.floor((rect.width + gap) / (dotSize + gap))
      const rowsAvailable = Math.floor((rect.height + gap) / (dotSize + gap))

      const totalSlots = dotsPerRow * rowsAvailable
      // Reserve 1 slot for overflow badge if needed
      setMaxVisible(Math.max(1, totalSlots - 1))
    }

    calculateMax()

    // Recalculate on resize
    const observer = new ResizeObserver(calculateMax)
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  // Only show completed habits
  const completedHabits = completions.filter((c) => c.isComplete)

  // Calculate overflow based on dynamic max
  const hasOverflow = completedHabits.length > maxVisible
  const visibleHabits = hasOverflow ? completedHabits.slice(0, maxVisible) : completedHabits
  const overflowCount = completedHabits.length - maxVisible

  return (
    <button
      onClick={onClick}
      className={`
        relative w-full h-full flex flex-col items-center p-1
        transition-colors
        hover:bg-zinc-800 active:bg-zinc-700
        ${isCurrentMonth ? '' : 'opacity-35'}
      `}
    >
      {/* Top: Date number - fixed height for consistency */}
      <div className="w-full h-7 flex items-center justify-center flex-shrink-0">
        <span
          className={`
            text-sm tabular-nums font-medium leading-none
            ${isToday
              ? 'flex items-center justify-center w-7 h-7 rounded-full bg-white text-black'
              : isCurrentMonth
                ? 'text-zinc-200'
                : 'text-zinc-500'
            }
          `}
        >
          {day.dayOfMonth}
        </span>
      </div>

      {/* Bottom: Dots flowing horizontally with wrap - responsive sizes */}
      <div
        ref={containerRef}
        className="flex-1 w-full flex flex-wrap justify-center content-start gap-1 sm:gap-1.5 overflow-hidden mt-1 sm:mt-1.5"
      >
        {visibleHabits.map(({ habit }) => {
          const color = habitDisplayColors.get(habit.id) || habit.color
          return (
            <div
              key={habit.id}
              className="w-5 h-5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: color }}
              title={habit.name}
            >
              {habit.emoji && (
                <span className="text-sm sm:text-lg leading-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>{habit.emoji}</span>
              )}
            </div>
          )
        })}

        {/* Overflow dot - styled like a system dot */}
        {hasOverflow && (
          <div
            className="w-5 h-5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-zinc-700 border border-zinc-600"
            title={`+${overflowCount} more`}
          >
            <span className="text-[10px] sm:text-xs font-medium text-zinc-300 leading-none">+{overflowCount}</span>
          </div>
        )}
      </div>
    </button>
  )
})
