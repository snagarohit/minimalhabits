# CLAUDE.md

## Project Overview
Minimal Habits - A habit tracking calendar app built with React + TypeScript + Vite. Deployed on Netlify at minimalhabits.samineni.me.

## Key Commands
- `npm run dev` - Start dev server
- `npm run build` - Build for production (runs tsc + vite build)
- `npm run preview` - Preview production build

## Architecture

### State Management
- `useHabits` hook manages all habit data (habits, completions, groups, timedEntries)
- Data persisted to localStorage (`habit-calendar-data`)
- Optional Google Drive sync via `useCloudSync` hook

### Color System
- **Colors are dynamic, not stored** - habit.color is deprecated
- Colors computed at runtime based on visible habits using OKLCH color space
- Evenly-spaced hues (360°/N) for maximum distinguishability
- Grays reserved for system UI (overflow badges, disabled states)

### Key Types
- `Habit` - id, name, groupId, emoji, createdAt (color is deprecated/optional)
- `HabitCompletion` - habitId, date, value
- `HabitGroup` - id, name, visible
- `TimedEntry` - id, habitId, date, startTime, duration

### Views
- **Month view** - Calendar grid with habit dots
- **Day view** - Timeline with timed entries, timers persist to localStorage

## Important Guidelines

### Git
- **NEVER push without explicit user consent** - Always wait for "push" or similar confirmation
- **NEVER add co-author credits** - Do not include "Co-Authored-By" in commits
- Commit messages should be concise and descriptive

### Code Style
- Prefer editing existing files over creating new ones
- No unnecessary abstractions or over-engineering
- Keep solutions simple and focused on the task

### Environment Variables
- `VITE_GOOGLE_CLIENT_ID` - Required for Google Drive backup (must be set in Netlify for production)

## File Structure
```
src/
  components/     # React components
  hooks/          # Custom hooks (useHabits, useGoogleAuth, useCloudSync, etc.)
  services/       # External services (driveStorage.ts)
  types/          # TypeScript types
  App.tsx         # Main app component
  config.ts       # App configuration
```
