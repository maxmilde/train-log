# Train Log

Mobile-first workout tracking PWA. Works in iPhone Safari, deploys to Netlify, data syncs across devices via Supabase.

## Quick Setup

### 1. Install Node.js
Download from https://nodejs.org (LTS version). Then restart your terminal.

### 2. Install dependencies
```bash
cd "workout-log"
npm install
```

### 3. Set up Supabase
1. Go to https://supabase.com and create a free account
2. Create a new project (note your project URL and anon key)
3. In the Supabase dashboard → SQL Editor → paste the contents of `supabase-schema.sql` and click Run
4. Go to Authentication → Providers → Email → enable "Email OTP" (magic link)
5. Optionally disable "Confirm email" for easier testing

### 4. Configure environment
```bash
cp .env.local.example .env.local
# Edit .env.local with your Supabase URL and anon key
```

### 5. Run locally
```bash
npm run dev
# Open http://localhost:5173 in your browser
```

### 6. Deploy to Netlify
1. Push this folder to a GitHub repository
2. Go to https://netlify.com → Add new site → Import from GitHub
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variables in Netlify: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
6. Deploy!

### 7. Open on iPhone
Visit your Netlify URL in iPhone Safari. Tap Share → Add to Home Screen for the full-screen PWA experience.

---

## Features

- **Year heatmap** — GitHub-style grid: green (workout), dark green (active rest), grey (rest)
- **Goal tracking** — set weekly target, see week/month/year progress with on-track indicator
- **Workout log** — tap any day on the heatmap to open it. Log exercises, kettlebell weights (12–32kg, single/double), sets and reps, optional time per set, total workout duration
- **Exercise autocomplete** — the app remembers every exercise you've done and suggests it
- **Personal bests** — shown inline next to the exercise name while logging
- **Interval timer** — set work/rest time and rounds. Says "Work" and "Rest" out loud at each phase change
- **Progress charts** — workout duration per week, workouts per month, full history for any exercise
- **Cross-device sync** — log in on any phone to see all your data

## App Structure

```
src/
  lib/        — Supabase client, DB queries, utilities, speech, chart setup
  context/    — Auth state (React context)
  hooks/      — useInterval (timer), useAutoSave
  components/ — UI components by feature
  pages/      — Dashboard, WorkoutDay, Timer, Progress, Login
```
