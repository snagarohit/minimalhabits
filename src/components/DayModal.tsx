import { useEffect, useRef, useMemo } from 'react'
import { format, parseISO, isToday as checkIsToday } from 'date-fns'
import type { Habit, HabitGroup } from '../types'

interface DayModalProps {
  dateString: string
  habits: Habit[]
  groups: HabitGroup[]
  getCompletionValue: (habitId: string, date: string) => number
  onToggleBinary: (habitId: string, date: string) => boolean
  onClose: () => void
  onCelebrate: () => void
}

export function DayModal({
  dateString,
  habits,
  groups,
  getCompletionValue,
  onToggleBinary,
  onClose,
  onCelebrate,
}: DayModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  // Organize ALL habits by group (not filtered by visibility)
  const organizedData = useMemo(() => {
    const ungrouped = habits.filter(h => !h.groupId)
    const grouped = groups
      .map(group => ({
        group,
        habits: habits.filter(h => h.groupId === group.id)
      }))
      .filter(g => g.habits.length > 0)
    return { ungrouped, grouped }
  }, [habits, groups])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose()
  }

  const date = parseISO(dateString)
  const isToday = checkIsToday(date)

  const completedCount = habits.filter(h => getCompletionValue(h.id, dateString) > 0).length

  // Handle habit toggle
  const handleToggle = (habitId: string) => {
    const completed = onToggleBinary(habitId, dateString)
    if (completed) onCelebrate()
  }

  // Render a habit chip button
  const renderHabitChip = (habit: Habit) => {
    const isComplete = getCompletionValue(habit.id, dateString) > 0

    return (
      <button
        key={habit.id}
        onClick={() => handleToggle(habit.id)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
          isComplete
            ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
            : 'bg-zinc-900/50 text-zinc-500 hover:bg-zinc-900'
        }`}
      >
        {habit.emoji && (
          <span className={!isComplete ? 'opacity-50' : ''}>{habit.emoji}</span>
        )}
        <span className={!isComplete ? 'opacity-70' : ''}>{habit.name}</span>
        {isComplete && (
          <svg className="h-3 w-3 ml-0.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
    )
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center sm:justify-center"
    >
      <div className="w-full max-h-[85vh] overflow-hidden bg-zinc-950 border-zinc-800 safe-area-bottom sm:max-w-md sm:rounded-xl sm:border rounded-t-xl border-t animate-in">
        {/* Drag handle (mobile only) */}
        <div className="sm:hidden mx-auto mt-3 h-1 w-12 rounded-full bg-zinc-800" />

        {/* Header */}
        <div className="sticky top-0 border-b border-zinc-800 bg-zinc-950 px-4 py-4">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-lg font-medium text-zinc-100">
                {isToday ? 'Today' : format(date, 'EEEE')}
              </h2>
              <p className="text-sm text-zinc-500">
                {format(date, 'MMMM d, yyyy')}
              </p>
            </div>
            {habits.length > 0 && (
              <span className="text-sm text-zinc-500">
                {completedCount}/{habits.length}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-4 py-4" style={{ maxHeight: 'calc(85vh - 100px)' }}>
          {habits.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-zinc-500">No habits yet</p>
              <p className="mt-1 text-sm text-zinc-600">
                Create habits using the edit button
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Grouped habits */}
              {organizedData.grouped.map(({ group, habits: groupHabits }) => (
                <div key={group.id} className="flex items-center gap-2 flex-wrap">
                  {/* Group label */}
                  <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-zinc-400">
                    <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    {group.name}
                  </div>
                  {/* Habits in group */}
                  {groupHabits.map((habit) => renderHabitChip(habit))}
                </div>
              ))}

              {/* Ungrouped habits */}
              {organizedData.ungrouped.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {organizedData.grouped.length > 0 && (
                    <span className="text-xs text-zinc-600 px-2">Ungrouped</span>
                  )}
                  {organizedData.ungrouped.map((habit) => renderHabitChip(habit))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-in-from-bottom {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (min-width: 640px) {
          @keyframes slide-in-from-bottom {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        }
        .animate-in {
          animation: slide-in-from-bottom 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
