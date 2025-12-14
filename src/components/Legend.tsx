import { useMemo, useState } from 'react'
import { ResponsiveDialog } from './ResponsiveDialog'
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

  // Get visible habits for legend
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

  // Organize habits by group
  const organizedData = useMemo(() => {
    const ungrouped = habits.filter(h => !h.groupId)
    const grouped = groups.map(group => ({
      group,
      habits: habits.filter(h => h.groupId === group.id)
    })).filter(g => g.habits.length > 0)
    return { ungrouped, grouped }
  }, [habits, groups])

  // Count visible/total
  const visibleCount = visibleHabits.length
  const totalCount = habits.length

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
                        {habit.emoji ? (
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: displayColor + '40' }}
                          >
                            <span className="text-xs leading-none">{habit.emoji}</span>
                          </div>
                        ) : (
                          <div
                            className="w-5 h-5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: displayColor }}
                          />
                        )}
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

          {habits.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-zinc-500 text-sm">No habits yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Grouped habits */}
              {organizedData.grouped.map(({ group, habits: groupHabits }) => (
                <div key={group.id} className="flex items-center gap-2 flex-wrap">
                  {/* Group toggle */}
                  <button
                    onClick={() => onToggleGroupVisibility(group.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      group.visible
                        ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                        : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'
                    }`}
                  >
                    <svg className={`h-3.5 w-3.5 ${group.visible ? 'text-zinc-400' : 'text-zinc-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    <span className={!group.visible ? 'line-through opacity-60' : ''}>{group.name}</span>
                  </button>

                  {/* Habits in this group */}
                  {groupHabits.map((habit) => {
                    const isVisible = visibleHabitIds.has(habit.id)
                    const groupHidden = !group.visible
                    return (
                      <button
                        key={habit.id}
                        onClick={() => !groupHidden && onToggleVisibility(habit.id)}
                        disabled={groupHidden}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          groupHidden
                            ? 'bg-zinc-900/50 text-zinc-600 cursor-not-allowed'
                            : isVisible
                              ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                              : 'bg-zinc-900/50 text-zinc-500 hover:bg-zinc-900'
                        }`}
                      >
                        {habit.emoji && (
                          <span className={!isVisible || groupHidden ? 'opacity-40' : ''}>{habit.emoji}</span>
                        )}
                        <span className={!isVisible || groupHidden ? 'line-through opacity-60' : ''}>{habit.name}</span>
                      </button>
                    )
                  })}
                </div>
              ))}

              {/* Ungrouped habits */}
              {organizedData.ungrouped.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {organizedData.grouped.length > 0 && (
                    <span className="text-xs text-zinc-600 px-2">Ungrouped</span>
                  )}
                  {organizedData.ungrouped.map((habit) => {
                    const isVisible = visibleHabitIds.has(habit.id)
                    return (
                      <button
                        key={habit.id}
                        onClick={() => onToggleVisibility(habit.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          isVisible
                            ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                            : 'bg-zinc-900/50 text-zinc-500 hover:bg-zinc-900'
                        }`}
                      >
                        {habit.emoji && (
                          <span className={!isVisible ? 'opacity-40' : ''}>{habit.emoji}</span>
                        )}
                        <span className={!isVisible ? 'line-through opacity-60' : ''}>{habit.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Quick actions */}
          {habits.length > 0 && (
            <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-zinc-800">
              <button
                onClick={() => {
                  // Show all
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
                }}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Show all
              </button>
              <span className="text-zinc-700">·</span>
              <button
                onClick={() => {
                  // Hide all
                  habits.forEach(h => {
                    if (visibleHabitIds.has(h.id)) {
                      onToggleVisibility(h.id)
                    }
                  })
                }}
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
