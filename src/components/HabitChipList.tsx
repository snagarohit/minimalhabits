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
  emptyMessage?: string
  emptySubMessage?: string
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
  emptyMessage = 'No habits yet',
  emptySubMessage = 'Use the edit button to add habits',
  showStrikethrough = false,
  onAddHabit,
}: HabitChipListProps) {
  // Organize habits by group
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

  if (habits.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-zinc-500 text-sm">{emptyMessage}</p>
        {emptySubMessage && (
          <p className="text-zinc-600 text-xs mt-1">{emptySubMessage}</p>
        )}
        {onAddHabit && (
          <button
            onClick={onAddHabit}
            className="mt-4 py-2.5 px-4 rounded-lg border border-dashed border-zinc-700 text-zinc-400 text-sm hover:border-zinc-600 hover:text-zinc-300 hover:bg-zinc-900/50 transition-colors inline-flex items-center gap-2"
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
      return (
        <button
          key={`group-${group.id}`}
          onClick={() => onGroupSelect(group.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isGroupSelected
              ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
              : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'
          }`}
        >
          <svg className={`h-3.5 w-3.5 ${isGroupSelected ? 'text-zinc-400' : 'text-zinc-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <span className={!isGroupSelected && showStrikethrough ? 'line-through opacity-60' : ''}>{group.name}</span>
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

    return (
      <button
        key={habit.id}
        onClick={() => !isDisabled && onSelect(habit.id)}
        disabled={isDisabled}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
          isDisabled
            ? 'bg-zinc-900/50 text-zinc-600 cursor-not-allowed'
            : isSelected
              ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
              : 'bg-zinc-900/50 text-zinc-500 hover:bg-zinc-900'
        }`}
      >
        {habit.emoji && (
          <span className={!isSelected || isDisabled ? 'opacity-50' : ''} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>{habit.emoji}</span>
        )}
        <span className={(!isSelected || isDisabled) && showStrikethrough ? 'line-through opacity-60' : (!isSelected ? 'opacity-70' : '')}>
          {habit.name}
        </span>
        {isSelected && !isDisabled && !showStrikethrough && (
          <svg className="h-3 w-3 ml-0.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-3">
      {/* Grouped habits */}
      {organizedData.grouped.map(({ group, habits: groupHabits }) => (
        <div key={group.id} className="flex items-center gap-2 flex-wrap">
          {renderGroupLabel(group)}
          {groupHabits.map(renderHabitChip)}
        </div>
      ))}

      {/* Ungrouped habits */}
      {organizedData.ungrouped.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {organizedData.grouped.length > 0 && (
            <span className="text-xs text-zinc-600 px-2">Ungrouped</span>
          )}
          {organizedData.ungrouped.map(renderHabitChip)}
        </div>
      )}

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
