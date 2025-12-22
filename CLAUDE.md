# CLAUDE.md

## Project Overview
Minimal Habits - A habit tracking calendar app built with Next.js + React + TypeScript. Deployed on Vercel/Netlify at minimalhabits.samineni.me.

## Key Commands
- `npm run dev` - Start dev server (port 3000)
- `npm run build` - Build for production
- `npm run start` - Start production server

## Architecture

### Framework
- **Next.js 16** with App Router
- Server-side API routes for OAuth token handling
- Client-side React components with SSR support

### State Management
- `useHabits` hook manages all habit data (habits, completions, groups, timedEntries)
- Data persisted to localStorage (`habit-calendar-data`)
- Optional Google Drive sync via `useCloudSync` hook

### Authentication Flow
- Google OAuth 2.0 with authorization code flow
- Server-side token exchange for secure refresh token handling
- API routes: `/api/auth/token` (code exchange), `/api/auth/refresh` (token refresh)
- Refresh tokens enable persistent sessions beyond 1 hour

### Color System
- **Colors are dynamic, not stored** - habit.color is deprecated
- Colors computed at runtime based on visible habits
- Curated palette for ≤10 habits, algorithmic HSL for more
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
Client-side (exposed to browser):
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - Google OAuth client ID

Server-side only (keep secret!):
- `GOOGLE_CLIENT_ID` - Same as above, for server API routes
- `GOOGLE_CLIENT_SECRET` - OAuth client secret from Google Cloud Console

## File Structure
```
src/
  app/
    api/
      auth/
        token/route.ts    # OAuth code exchange
        refresh/route.ts  # Token refresh
    layout.tsx            # Root layout
    page.tsx              # Main page (client component)
    globals.css           # Global styles
  components/             # React components
  hooks/                  # Custom hooks (useHabits, useGoogleAuth, useCloudSync, etc.)
  services/               # External services (driveStorage.ts)
  types/                  # TypeScript types
  App.tsx                 # Main app component
  config.ts               # App configuration
```
