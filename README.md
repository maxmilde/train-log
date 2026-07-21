# Train Log

**Train Log is a mobile-first workout tracking app** built for kettlebell, bodyweight, and weight-vest training. It's a Progressive Web App (PWA) — you add it to your iPhone home screen and it behaves like a native app, fully offline-capable, with your data syncing across devices.

It's designed around how people actually train: logging sets and reps as you go, tracking single vs. double kettlebell work, grouping exercises into repeating "complexes," greasing the groove throughout the day, and — most importantly — seeing whether you're actually progressing week over week and month over month.

## What it's for

- **Log workouts fast** on your phone, mid-session
- **Track real progress** — not just "did I train?" but "am I doing more total work, and am I moving heavier weight?"
- **Keep a searchable history** of every exercise, weight configuration, and personal best you've ever hit.
- **Plan the next session** with data-driven exercise suggestions based on what you've been neglecting.

## Features

### Logging
- **Flexible exercise entry** — name autocomplete that remembers every exercise you've logged. Add an exercise and a first set appears instantly, ready to fill in.
- **Per-set weight & type** — each set carries its own weight (10–32 kg) and type (1× single / 2× double kettlebell). Mix weights within a single exercise — e.g. 5 sets at 2×24 kg, then bump to 2×28 kg mid-exercise, and it's all tracked separately.
- **Bodyweight & weight vest** — bodyweight exercises (pushups, pullups) log as reps only. The 10 kg weight vest is handled specially: plain rep counts, no 1×/2× toggle, load counted as `reps × 10`.
- **Rounds multiplier** — instead of logging "10 pushups" five times, log 10 reps and bump the round counter as you complete each round. Great for greasing the groove.
- **Complexes** — group several exercises that repeat together as a unit (e.g. 10 pushups → 10 long cycle → 6 hindu squats → 10 pushups = 1 round), then count rounds of the whole block. Save and reload complexes you've done before from a template picker.
- **Copy a previous workout** to today with one tap — exercises, complexes, weights, and structure all reproduced.
- **Workout notes & duration** — free-text notes (auto-saved as you type) and optional session duration. Skip the duration on greasing-the-groove days and it won't skew your averages.
- **Reorderable** — drag exercises and complexes up/down to match your session order.

### Timer
- **Interval timer** with configurable work / rest / rounds, a 5-second countdown before you start, and spoken "Work" / "Rest" cues.
- **EMOM mode** — every-minute-on-the-minute style: work-only rounds with an audio + visual cue at each round boundary.
- **Adjust mid-session** — change work or rest length while the timer is running and it applies to the current phase.
- **Floating timer bar** — keeps the running timer visible while you navigate the rest of the app.

### Analytics
- **Volume tracking (Day / Week / Month)** — total reps and total *load* (reps × weight) per exercise and per weight bucket, so lifting heavier for fewer reps still reads as progress. Compared against your personal best for that period, with sparklines and a 12-period bar chart.
- **Personal bests** — tracked per (exercise, weight type, weight) so 1×24 kg and 2×24 kg keep separate records. Shown inline while logging.
- **Exercise history** — full per-exercise breakdown of every session, weights, and PBs.
- **Exercise catalog** — every exercise you've logged, sortable A–Z / Z–A / by volume, with inline rename (updates all history) and delete.
- **Workout feed** — reverse-chronological log of every submitted session with infinite scroll.
- **Workout suggestions** — a "Suggest" tab picks your next session from a pool you choose, prioritizing exercises you've done least in the last 30 days. Re-roll for a different combination.

### Dashboard
- **Year heatmap** — GitHub-style grid: green (workout), dark green (active rest), grey (rest).
- **Goal tracking** — weekly target with week / month / year progress and an on-track indicator.
- **This-week volume teaser** + duration and monthly-count charts.

### Platform
- **Cross-device sync** via Supabase — log in on any phone and see all your data.
- **PWA** — installable, offline-capable, full-screen on iOS.
- **Private by design** — every table is protected by row-level security, so your data is only ever visible to you.

---

## Setup

### 1. Install Node.js
Download from https://nodejs.org (LTS version), then restart your terminal.

### 2. Install dependencies
```bash
cd "workout-log"
npm install
```

### 3. Set up Supabase
1. Go to https://supabase.com and create a free account.
2. Create a new project (note your project URL and anon key).
3. In the dashboard → **SQL Editor** → paste the contents of `supabase-schema.sql` and click **Run**. This creates all tables, indexes, and row-level-security policies (safe to re-run).
4. Go to **Authentication → Providers → Email** and enable email sign-in.
5. For a public deployment, turn **off** "Allow new users to sign up" once you've created your own account (Authentication → Providers → Email) so strangers can't register.

### 4. Configure environment
```bash
cp .env.local.example .env.local
# Edit .env.local with your Supabase URL and anon key
```
> The anon key is safe to expose in the client — row-level security is what protects your data. Never put the **service_role** key in this file.

### 5. Run locally
```bash
npm run dev
# Open http://localhost:5173
```

### 6. Deploy to Netlify
1. Push this folder to a GitHub repository.
2. Go to https://netlify.com → **Add new site → Import from GitHub**.
3. Build command: `npm run build` · Publish directory: `dist`.
4. Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Deploy.

### 7. Install on iPhone
Open your Netlify URL in Safari, tap **Share → Add to Home Screen**.

---

## Tech stack

- **React 18 + Vite** — UI and build tooling
- **Tailwind CSS** — dark-mode styling
- **Supabase** — Postgres database + authentication (with row-level security)
- **Chart.js** (via react-chartjs-2) — analytics charts
- **date-fns** — date/period math
- **react-router-dom** — routing
- Deployed on **Netlify** (SPA redirects via `netlify.toml`)

## App structure

```
src/
  lib/         — Supabase client, DB queries (db.js), utilities, speech, chart setup
  context/     — Auth state and interval-timer state (React context)
  hooks/       — useInterval (timer)
  components/  — UI grouped by feature (workout, progress, dashboard, calendar, layout, auth)
  pages/       — Dashboard, WorkoutDay, Timer, Library, Login
supabase-schema.sql  — full database schema; run in the Supabase SQL editor
```

### Data model

- `workout_days` — one row per calendar day (type, duration, notes, submitted flag)
- `workout_exercises` — exercises within a day; may belong to a complex
- `workout_complexes` — a group of exercises with a shared rounds multiplier
- `exercise_sets` — individual sets (reps, per-set weight/type, rounds)
- `user_settings` — per-user preferences (weekly goal)

All tables enforce row-level security so each user can only read and write their own rows.
