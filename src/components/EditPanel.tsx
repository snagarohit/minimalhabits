import { useEffect, useState, useMemo } from 'react'
import { EmojiPicker } from './EmojiPicker'
import { ResponsiveDialog } from './ResponsiveDialog'
import { UNGROUPED_GROUP_ID } from '../hooks/useHabits'
import type { Habit, HabitGroup } from '../types'

interface EditPanelProps {
  isOpen: boolean
  onClose: () => void
  habits: Habit[]
  groups: HabitGroup[]
  getStreak: (habitId: string) => number
  onAddHabit: (options: {
    name: string
    groupId?: string
    color?: string
    emoji?: string
  }) => Habit
  onUpdateHabit: (id: string, updates: {
    name?: string
    groupId?: string
    emoji?: string
  }) => void
  onDeleteHabit: (habitId: string) => void
  onAddGroup: (name: string) => HabitGroup
  onDeleteGroup: (groupId: string) => void
  onUpdateGroup: (groupId: string, name: string) => void
  initialMode?: 'list' | 'add-habit'
}

// Editing state for a habit
interface HabitEditState {
  name: string
  emoji: string
  groupId: string | undefined
}

export function EditPanel({
  isOpen,
  onClose,
  habits,
  groups,
  getStreak,
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
  onAddGroup,
  onDeleteGroup,
  onUpdateGroup,
  initialMode = 'list',
}: EditPanelProps) {
  // Mode: 'list' | 'edit-habit' | 'edit-group' | 'add-habit'
  const [mode, setMode] = useState<'list' | 'edit-habit' | 'edit-group' | 'add-habit'>('list')
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  // Habit editing state
  const [habitEdit, setHabitEdit] = useState<HabitEditState>({
    name: '',
    emoji: '',
    groupId: undefined,
  })

  // Group editing state
  const [groupName, setGroupName] = useState('')

  // New group creation (inline)
  const [showNewGroup, setShowNewGroup] = useState(false)

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')

  // Organize habits by group (all habits now belong to a group)
  const groupedHabits = useMemo(() => {
    return groups.map(group => ({
      group,
      habits: habits.filter(h => h.groupId === group.id)
    }))
  }, [habits, groups])

  // Get the original habit for comparison
  const originalHabit = useMemo(() => {
    if (!selectedHabitId) return null
    return habits.find(h => h.id === selectedHabitId) || null
  }, [selectedHabitId, habits])

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (mode === 'add-habit') {
      // Name is required, group/emoji are optional changes
      return habitEdit.name.trim().length > 0
    }
    if (mode === 'edit-habit' && originalHabit) {
      // Check for inline new group creation
      const hasNewGroupChange = showNewGroup && newGroupName.trim().length > 0
      // Check if any field changed from original
      const nameChanged = habitEdit.name !== originalHabit.name
      const emojiChanged = habitEdit.emoji !== (originalHabit.emoji || '')
      const groupChanged = habitEdit.groupId !== originalHabit.groupId
      return nameChanged || emojiChanged || groupChanged || hasNewGroupChange
    }
    if (mode === 'edit-group' && selectedGroupId) {
      const group = groups.find(g => g.id === selectedGroupId)
      return group ? groupName !== group.name : false
    }
    return false
  }, [mode, habitEdit, originalHabit, groupName, selectedGroupId, groups, showNewGroup, newGroupName])

  // Reset when panel closes, set initial mode when opens
  useEffect(() => {
    if (!isOpen) {
      setMode('list')
      setSelectedHabitId(null)
      setSelectedGroupId(null)
      setShowNewGroup(false)
      setNewGroupName('')
    } else if (initialMode === 'add-habit') {
      // Open directly in add-habit mode
      setSelectedHabitId(null)
      setHabitEdit({
        name: '',
        emoji: '',
        groupId: UNGROUPED_GROUP_ID,
      })
      setMode('add-habit')
    }
  }, [isOpen, initialMode])

  const startEditingHabit = (habit: Habit) => {
    setSelectedHabitId(habit.id)
    setHabitEdit({
      name: habit.name,
      emoji: habit.emoji || '',
      groupId: habit.groupId,
    })
    setMode('edit-habit')
  }

  const startAddingHabit = () => {
    setSelectedHabitId(null)
    setHabitEdit({
      name: '',
      emoji: '',
      groupId: UNGROUPED_GROUP_ID,
    })
    setMode('add-habit')
  }

  const startEditingGroup = (group: HabitGroup) => {
    setSelectedGroupId(group.id)
    setGroupName(group.name)
    setMode('edit-group')
  }

  const handleSaveHabit = () => {
    if (mode === 'add-habit') {
      if (!habitEdit.name.trim()) return

      // Create group if needed
      let finalGroupId = habitEdit.groupId
      if (showNewGroup && newGroupName.trim()) {
        const newGroup = onAddGroup(newGroupName.trim())
        finalGroupId = newGroup.id
      }

      onAddHabit({
        name: habitEdit.name.trim(),
        emoji: habitEdit.emoji || undefined,
        groupId: finalGroupId,
      })
      setMode('list')
      setShowNewGroup(false)
      setNewGroupName('')
    } else if (mode === 'edit-habit' && selectedHabitId) {
      // Create group if needed
      let finalGroupId = habitEdit.groupId
      if (showNewGroup && newGroupName.trim()) {
        const newGroup = onAddGroup(newGroupName.trim())
        finalGroupId = newGroup.id
      }

      onUpdateHabit(selectedHabitId, {
        name: habitEdit.name.trim(),
        emoji: habitEdit.emoji || undefined,
        groupId: finalGroupId,
      })
      setMode('list')
      setShowNewGroup(false)
      setNewGroupName('')
    }
  }

  const handleSaveGroup = () => {
    if (selectedGroupId && groupName.trim()) {
      onUpdateGroup(selectedGroupId, groupName.trim())
      setMode('list')
    }
  }

  const handleDeleteHabit = () => {
    if (selectedHabitId) {
      onDeleteHabit(selectedHabitId)
      setMode('list')
    }
  }

  const handleDeleteGroup = () => {
    if (selectedGroupId) {
      onDeleteGroup(selectedGroupId)
      setMode('list')
    }
  }

  const handleBack = () => {
    setMode('list')
    setShowNewGroup(false)
    setNewGroupName('')
  }

  const handleClose = () => {
    if (mode !== 'list') {
      setMode('list')
      setShowNewGroup(false)
      setNewGroupName('')
    } else {
      onClose()
    }
  }

  // Render habit edit form
  const renderHabitForm = () => (
    <div className="space-y-5">
      {/* Icon + Name on same line */}
      <div className="flex items-start gap-2">
        {/* Icon field */}
        <div className="relative">
          <label className="block text-xs text-zinc-500 mb-1.5 text-center">Emoji</label>
          <button
            type="button"
            onClick={() => setShowEmojiPicker(true)}
            className="w-12 h-10 rounded-lg border border-zinc-800 bg-zinc-900 text-center text-lg text-zinc-100 hover:border-zinc-600 transition-colors flex items-center justify-center"
          >
            {habitEdit.emoji || <span className="opacity-30">😊</span>}
          </button>
          {habitEdit.emoji && (
            <button
              type="button"
              onClick={() => setHabitEdit(prev => ({ ...prev, emoji: '' }))}
              className="absolute top-5 -right-1 w-4 h-4 rounded-full bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200 flex items-center justify-center"
            >
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {/* Name field */}
        <div className="flex-1">
          <label className="block text-xs text-zinc-500 mb-1.5">Name</label>
          <input
            type="text"
            value={habitEdit.name}
            onChange={(e) => setHabitEdit(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Exercise, Read, Meditate"
            className="w-full h-10 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
            autoFocus
          />
        </div>
      </div>

      {/* Group */}
      <div>
        <label className="block text-xs text-zinc-500 mb-1.5">Group</label>
        {showNewGroup ? (
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name..."
              className="flex-1 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                setShowNewGroup(false)
                setNewGroupName('')
              }}
              className="p-2 text-zinc-500 hover:text-zinc-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setHabitEdit(prev => ({ ...prev, groupId: group.id }))}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  habitEdit.groupId === group.id
                    ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
                    : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'
                }`}
              >
                {group.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowNewGroup(true)}
              className="rounded-lg border border-dashed border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 hover:border-zinc-600 hover:text-zinc-400"
            >
              + New
            </button>
          </div>
        )}
      </div>

      {/* Streak info (edit mode only) */}
      {mode === 'edit-habit' && originalHabit && getStreak(originalHabit.id) > 0 && (
        <div className="text-xs text-zinc-500 text-center py-2">
          Current streak: {getStreak(originalHabit.id)} days
        </div>
      )}
    </div>
  )

  return (
    <ResponsiveDialog isOpen={isOpen} onClose={handleClose} title={
      mode === 'list' ? 'Add / Edit Habits' :
      mode === 'add-habit' ? 'New Habit' :
      mode === 'edit-habit' ? 'Edit Habit' :
      'Edit Group'
    }>
      <div className="px-4 py-4">
        {mode === 'list' ? (
          // List view
          <div>
            {habits.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-zinc-500 text-sm">No habits yet</p>
                <p className="text-zinc-600 text-xs mt-1">Tap the button below to create one</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* All habits organized by group */}
                {groupedHabits.map(({ group, habits: groupHabits }) => (
                  <div key={group.id} className="flex items-center gap-2 flex-wrap">
                    {/* Group label/button - "Ungrouped" is not editable */}
                    {group.id === UNGROUPED_GROUP_ID ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/50 text-zinc-400">
                        <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                        </svg>
                        {group.name}
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditingGroup(group)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-zinc-800 text-zinc-200 hover:bg-zinc-700 group/btn"
                      >
                        <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                        </svg>
                        {group.name}
                        <svg className="h-3 w-3 text-zinc-500 group-hover/btn:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                    )}

                    {/* Habits in group */}
                    {groupHabits.map((habit) => (
                      <button
                        key={habit.id}
                        onClick={() => startEditingHabit(habit)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors bg-zinc-900 text-zinc-300 hover:bg-zinc-800 group/btn"
                      >
                        {habit.emoji && <span style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>{habit.emoji}</span>}
                        {habit.name}
                        <svg className="h-3 w-3 text-zinc-600 group-hover/btn:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Add button at bottom */}
            <button
              onClick={startAddingHabit}
              className="w-full mt-4 py-2.5 px-4 rounded-lg border border-dashed border-zinc-700 text-zinc-400 text-sm hover:border-zinc-600 hover:text-zinc-300 hover:bg-zinc-900/50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add new habit
            </button>
          </div>
        ) : mode === 'edit-group' ? (
          // Edit group view
          <div>
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 mb-4"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back
            </button>

            <div className="mb-6">
              <label className="block text-xs text-zinc-500 mb-1.5">Group name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                autoFocus
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={handleDeleteGroup}
                className="px-4 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-zinc-900 rounded-lg transition-colors"
              >
                Delete
              </button>
              <div className="flex-1" />
              <button
                onClick={handleBack}
                className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGroup}
                disabled={!hasChanges || !groupName.trim()}
                className="px-4 py-2 text-xs bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          // Add/Edit habit view
          <div>
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 mb-4"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back
            </button>

            {renderHabitForm()}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-6 pt-4 border-t border-zinc-800">
              {mode === 'edit-habit' && (
                <button
                  onClick={handleDeleteHabit}
                  className="px-4 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-zinc-900 rounded-lg transition-colors"
                >
                  Delete
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={handleBack}
                className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveHabit}
                disabled={!hasChanges || !habitEdit.name.trim()}
                className="px-4 py-2 text-xs bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {mode === 'add-habit' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Emoji Picker Dialog */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={(emoji) => {
            setHabitEdit(prev => ({ ...prev, emoji }))
            setShowEmojiPicker(false)
          }}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </ResponsiveDialog>
  )
}
