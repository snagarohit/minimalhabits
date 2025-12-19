import { useMemo } from 'react'
import type { Habit, HabitGroup } from '../types'

interface HabitChipListProps {
  habits: Habit[]
  groups: HabitGroup[]
  getIsSelected?: (habitId: string) => boolean
  getIsDisabled?: (habitId: string) => boolean
  onSelect: (habitId: string) => void
  onGroupSelect?: (groupId: string) => void
  getIsGroupSelected?: (groupId: string) => boolean
  showStrikethrough?: boolean // Show strikethrough on unselected items
  onAddHabit?: () => void // Optional callback to add a new habit
}

export function HabitChipList({
  habits,
  groups,
  getIsSelected,
  getIsDisabled,
  onSelect,
  onGroupSelect,
  getIsGroupSelected,
  showStrikethrough = false,
  onAddHabit,
}: HabitChipListProps) {
  // Organize habits by group (all habits now belong to a group)
  const groupedHabits = useMemo(() => {
    return groups
      .map(group => ({
        group,
        habits: habits.filter(h => h.groupId === group.id)
      }))
      .filter(g => g.habits.length > 0)
  }, [habits, groups])

  if (habits.length === 0) {
    return (
      <div>
        <div className="py-8 text-center">
          <p className="text-zinc-500 text-sm">No habits yet</p>
          <p className="text-zinc-600 text-xs mt-1">Tap the button below to create one</p>
        </div>
        {onAddHabit && (
          <button
            onClick={onAddHabit}
            className="w-full mt-4 py-2.5 px-4 rounded-lg border border-dashed border-zinc-700 text-zinc-400 text-sm hover:border-zinc-600 hover:text-zinc-300 hover:bg-zinc-900/50 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add new habit
          </button>
        )}
      </div>
    )
  }

  const renderGroupLabel = (group: HabitGroup) => {
    // If group selection is enabled, render as a button
    if (onGroupSelect && getIsGroupSelected) {
      const isGroupSelected = getIsGroupSelected(group.id)
      const isGroupVisible = isGroupSelected
      return (
        <button
          key={`group-${group.id}`}
          onClick={() => onGroupSelect(group.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-zinc-900 hover:bg-zinc-800 focus:outline-none focus:ring-0 focus:bg-zinc-900 active:bg-zinc-800 ${
            !isGroupVisible && showStrikethrough ? 'opacity-50' : ''
          }`}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <svg className={`h-3.5 w-3.5 ${!isGroupVisible && showStrikethrough ? 'text-zinc-600' : 'text-zinc-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <span className={`${!isGroupVisible && showStrikethrough ? 'text-zinc-500' : 'text-zinc-200'}`}>{group.name}</span>
          {/* Eye icon at end - matches edit panel pencil style */}
          {showStrikethrough && (
            isGroupVisible ? (
              <svg className="h-3 w-3 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ) : (
              <svg className="h-3 w-3 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            )
          )}
        </button>
      )
    }

    // Otherwise render as a static label
    return (
      <div key={`group-${group.id}`} className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-zinc-400">
        <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
        {group.name}
      </div>
    )
  }

  const renderHabitChip = (habit: Habit) => {
    const isSelected = getIsSelected?.(habit.id) ?? false
    const isDisabled = getIsDisabled?.(habit.id) ?? false
    const isVisible = isSelected && !isDisabled

    return (
      <button
        key={habit.id}
        onClick={() => !isDisabled && onSelect(habit.id)}
        disabled={isDisabled}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors bg-zinc-900 hover:bg-zinc-800 focus:outline-none focus:ring-0 focus:bg-zinc-900 active:bg-zinc-800 ${
          isDisabled ? 'cursor-not-allowed opacity-40' : ''
        } ${!isVisible && showStrikethrough ? 'opacity-50' : ''}`}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {habit.emoji && (
          <span style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>{habit.emoji}</span>
        )}
        <span className={`${!isVisible && showStrikethrough ? 'text-zinc-500' : 'text-zinc-300'}`}>
          {habit.name}
        </span>
        {/* Eye icon at end - matches edit panel pencil style */}
        {showStrikethrough && (
          isVisible ? (
            <svg className="h-3 w-3 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ) : (
            <svg className="h-3 w-3 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          )
        )}
      </button>
    )
  }

  return (
    <div className="space-y-3">
      {/* All habits organized by group */}
      {groupedHabits.map(({ group, habits: groupHabits }) => (
        <div key={group.id} className="flex items-center gap-2 flex-wrap">
          {renderGroupLabel(group)}
          {groupHabits.map(renderHabitChip)}
        </div>
      ))}

      {/* Add habit button */}
      {onAddHabit && (
        <button
          onClick={onAddHabit}
          className="w-full mt-4 py-2.5 px-4 rounded-lg border border-dashed border-zinc-700 text-zinc-400 text-sm hover:border-zinc-600 hover:text-zinc-300 hover:bg-zinc-900/50 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add new habit
        </button>
      )}
    </div>
  )
}
