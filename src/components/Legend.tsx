import { useMemo, useState, useCallback } from 'react'
import { ResponsiveDialog } from './ResponsiveDialog'
import { HabitChipList } from './HabitChipList'
import type { Habit, HabitGroup } from '../types'

interface LegendProps {
  habits: Habit[]
  groups: HabitGroup[]
  visibleHabitIds: Set<string>
  habitDisplayColors: Map<string, string>
  onToggleVisibility: (habitId: string) => void
  onToggleGroupVisibility: (groupId: string) => void
}

export function Legend({
  habits,
  groups,
  visibleHabitIds,
  habitDisplayColors,
  onToggleVisibility,
  onToggleGroupVisibility,
}: LegendProps) {
  const [showVisibilityDialog, setShowVisibilityDialog] = useState(false)

  // Get visible habits for legend display
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
      <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-950">
        {/* Main legend bar */}
        <div className="px-4 py-2.5">
          {/* Branding - above legend */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-600 mb-2">
            <span className="font-medium text-zinc-500">Minimal Habits</span>
            <span>·</span>
            <span>Designed in <span className="text-zinc-500">Cupertino</span></span>
            <span>·</span>
            <span className="text-zinc-500">Naga Samineni</span>
          </div>

          {/* Habit legend with filter button on right */}
          <div className="flex items-center gap-2">
            {/* Center: Habit legend */}
            <div className="flex-1 min-w-0">
              {visibleHabits.length > 0 ? (
                <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
                  {visibleHabits.map((habit) => {
                    const displayColor = habitDisplayColors.get(habit.id) || habit.color
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
                <div className="text-center text-xs text-zinc-600">All habits hidden</div>
              ) : null}
            </div>

            {/* Right: Filter button */}
            {habits.length > 0 && (
              <button
                onClick={() => setShowVisibilityDialog(true)}
                className="flex h-7 w-7 items-center justify-center rounded transition-colors flex-shrink-0 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                title="Show / Hide"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                </svg>
              </button>
            )}
          </div>
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
            emptyMessage="No habits yet"
            emptySubMessage=""
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
