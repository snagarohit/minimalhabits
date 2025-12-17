import { useEffect, useRef } from 'react'
import { format, parseISO, isToday as checkIsToday } from 'date-fns'
import { HabitChipList } from './HabitChipList'
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
          <HabitChipList
            habits={habits}
            groups={groups}
            getIsSelected={(habitId) => getCompletionValue(habitId, dateString) > 0}
            onSelect={handleToggle}
          />
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
