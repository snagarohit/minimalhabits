import { memo } from 'react'
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

export const DayCell = memo(function DayCell({
  day,
  completions,
  totalHabits: _totalHabits,
  habitDisplayColors,
  onClick,
}: DayCellProps) {
  const isCurrentMonth = day.isCurrentMonth
  const isToday = day.isToday

  // Only show completed habits
  const completedHabits = completions.filter((c) => c.isComplete)

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
      {/* Top: Date number */}
      <div className="w-full flex items-center justify-center mb-1">
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
      <div className="flex-1 w-full flex flex-wrap justify-center content-start gap-1 sm:gap-1.5 overflow-hidden">
        {completedHabits.map(({ habit }) => {
          const color = habitDisplayColors.get(habit.id) || habit.color
          return habit.emoji ? (
            <div
              key={habit.id}
              className="w-5 h-5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: color + '40' }}
              title={habit.name}
            >
              <span className="text-sm sm:text-lg leading-none">{habit.emoji}</span>
            </div>
          ) : (
            <div
              key={habit.id}
              className="w-5 h-5 sm:w-7 sm:h-7 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
              title={habit.name}
            />
          )
        })}
      </div>
    </button>
  )
})
