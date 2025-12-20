import { useMemo, useState, useCallback } from 'react'
import { ResponsiveDialog } from './ResponsiveDialog'
import { HabitChipList } from './HabitChipList'
import type { Habit, HabitGroup } from '../types'

interface LegendProps {
  habits: Habit[]
  groups: HabitGroup[]
  visibleHabitIds: Set<string>
  habitDisplayColors: Map<string, string>
  habitsInView: Habit[] // Habits with data in current view
  onToggleVisibility: (habitId: string) => void
  onToggleGroupVisibility: (groupId: string) => void
}

export function Legend({
  habits,
  groups,
  visibleHabitIds,
  habitDisplayColors,
  habitsInView,
  onToggleVisibility,
  onToggleGroupVisibility,
}: LegendProps) {
  const [showVisibilityDialog, setShowVisibilityDialog] = useState(false)

  // Get visible habits for filter count (respecting visibility settings)
  const visibleHabits = useMemo(() => {
    return habits.filter((h) => {
      if (!visibleHabitIds.has(h.id)) return false
      if (h.groupId) {
        const group = groups.find(g => g.id === h.groupId)
        if (group && !group.visible) return false
      }
      return true
    })
  }, [habits, visibleHabitIds, groups])

  // Count visible/total
  const visibleCount = visibleHabits.length
  const totalCount = habits.length

  // Check if a habit is visible (selected)
  const getIsSelected = useCallback((habitId: string) => {
    return visibleHabitIds.has(habitId)
  }, [visibleHabitIds])

  // Check if a habit is disabled (its group is hidden)
  const getIsDisabled = useCallback((habitId: string) => {
    const habit = habits.find(h => h.id === habitId)
    if (!habit?.groupId) return false
    const group = groups.find(g => g.id === habit.groupId)
    return group ? !group.visible : false
  }, [habits, groups])

  // Check if a group is visible (selected)
  const getIsGroupSelected = useCallback((groupId: string) => {
    const group = groups.find(g => g.id === groupId)
    return group?.visible ?? false
  }, [groups])

  // Show all habits
  const handleShowAll = useCallback(() => {
    habits.forEach(h => {
      if (!visibleHabitIds.has(h.id)) {
        onToggleVisibility(h.id)
      }
    })
    groups.forEach(g => {
      if (!g.visible) {
        onToggleGroupVisibility(g.id)
      }
    })
  }, [habits, groups, visibleHabitIds, onToggleVisibility, onToggleGroupVisibility])

  // Hide all habits
  const handleHideAll = useCallback(() => {
    habits.forEach(h => {
      if (visibleHabitIds.has(h.id)) {
        onToggleVisibility(h.id)
      }
    })
  }, [habits, visibleHabitIds, onToggleVisibility])

  return (
    <>
      <div className="flex-1 min-w-0">
        {/* Habit legend with filter button on right */}
        <div className="flex items-center gap-2">
            {/* Center: Habit legend (clickable to open filter) - shows only habits with data in view */}
            <button
              onClick={() => setShowVisibilityDialog(true)}
              className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
            >
              {habitsInView.length > 0 ? (
                <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
                  {habitsInView.map((habit) => {
                    const displayColor = habitDisplayColors.get(habit.id) || '#888'
                    return (
                      <div key={habit.id} className="flex items-center gap-1.5">
                        <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: displayColor }}
                      >
                        {habit.emoji && (
                          <span className="text-xs leading-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>{habit.emoji}</span>
                        )}
                      </div>
                        <span className="text-xs text-zinc-400">{habit.name}</span>
                      </div>
                    )
                  })}
                </div>
              ) : habits.length > 0 ? (
                <div className="text-center text-xs text-zinc-600">No habits in view</div>
              ) : null}
            </button>

            {/* Right: Filter button */}
            {habits.length > 0 && (
              <button
                onClick={() => setShowVisibilityDialog(true)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700 transition-colors flex-shrink-0 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                title="Show / Hide"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                </svg>
              </button>
            )}
          </div>
      </div>

      {/* Visibility Dialog */}
      <ResponsiveDialog
        isOpen={showVisibilityDialog}
        onClose={() => setShowVisibilityDialog(false)}
        title="Show / Hide"
      >
        <div className="px-4 py-4">
          {/* Count indicator */}
          <div className="text-xs text-zinc-500 mb-4">
            Showing {visibleCount} of {totalCount} habits
          </div>

          <HabitChipList
            habits={habits}
            groups={groups}
            getIsSelected={getIsSelected}
            getIsDisabled={getIsDisabled}
            onSelect={onToggleVisibility}
            onGroupSelect={onToggleGroupVisibility}
            getIsGroupSelected={getIsGroupSelected}
            showStrikethrough={true}
          />

          {/* Quick actions */}
          {habits.length > 0 && (
            <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-zinc-800">
              <button
                onClick={handleShowAll}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Show all
              </button>
              <span className="text-zinc-700">·</span>
              <button
                onClick={handleHideAll}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Hide all
              </button>
            </div>
          )}
        </div>
      </ResponsiveDialog>
    </>
  )
}
