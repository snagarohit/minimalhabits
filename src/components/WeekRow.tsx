import { memo } from 'react'
import { DayCell } from './DayCell'
import type { WeekData, Habit } from '../types'

interface HabitCompletion {
  habit: Habit
  value: number
  isComplete: boolean
}

interface WeekRowProps {
  week: WeekData
  habits: Habit[]
  habitDisplayColors: Map<string, string>
  getDayCompletions: (date: string) => HabitCompletion[]
  onDayClick: (dateString: string) => void
}

export const WeekRow = memo(function WeekRow({
  week,
  habits,
  habitDisplayColors,
  getDayCompletions,
  onDayClick,
}: WeekRowProps) {
  return (
    <div className="grid grid-cols-7 h-full">
      {week.days.map((day) => (
        <DayCell
          key={day.dateString}
          day={day}
          completions={getDayCompletions(day.dateString)}
          totalHabits={habits.length}
          habitDisplayColors={habitDisplayColors}
          onClick={() => onDayClick(day.dateString)}
        />
      ))}
    </div>
  )
})
