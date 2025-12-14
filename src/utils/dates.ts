import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addWeeks,
  subWeeks,
  isToday,
  isSameMonth,
  getMonth,
  getYear,
  startOfMonth,
  differenceInWeeks,
} from 'date-fns'
import type { WeekData } from '../types'

const WEEKS_BACK = 52 // 1 year back
const WEEKS_FORWARD = 52 // 1 year forward

export function getDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function generateWeekData(weekStart: Date, currentMonth: Date): WeekData {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  return {
    weekStart,
    days: days.map((date) => ({
      date,
      dateString: getDateString(date),
      dayOfMonth: date.getDate(),
      isToday: isToday(date),
      isCurrentMonth: isSameMonth(date, currentMonth),
      month: getMonth(date),
      year: getYear(date),
    })),
  }
}

export function generateAllWeeks(): WeekData[] {
  const today = new Date()
  const currentMonth = startOfMonth(today)
  const todayWeekStart = startOfWeek(today, { weekStartsOn: 0 })

  const weeks: WeekData[] = []

  // Generate weeks going back
  for (let i = WEEKS_BACK; i > 0; i--) {
    const weekStart = subWeeks(todayWeekStart, i)
    weeks.push(generateWeekData(weekStart, currentMonth))
  }

  // Current week
  weeks.push(generateWeekData(todayWeekStart, currentMonth))

  // Generate weeks going forward
  for (let i = 1; i <= WEEKS_FORWARD; i++) {
    const weekStart = addWeeks(todayWeekStart, i)
    weeks.push(generateWeekData(weekStart, currentMonth))
  }

  return weeks
}

export function getTodayWeekIndex(): number {
  return WEEKS_BACK // The current week is at index WEEKS_BACK
}

export function getMonthYearString(date: Date): string {
  return format(date, 'MMMM yyyy')
}

export function getWeekIndexForDate(date: Date, weeks: WeekData[]): number {
  if (weeks.length === 0) return 0
  const targetWeekStart = startOfWeek(date, { weekStartsOn: 0 })
  const firstWeekStart = weeks[0].weekStart
  return differenceInWeeks(targetWeekStart, firstWeekStart)
}
