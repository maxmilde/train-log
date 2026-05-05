# `suggest` Edge Function

Server-side proxy to the Anthropic API. The frontend calls this function via `supabase.functions.invoke('suggest', ...)`. The `ANTHROPIC_API_KEY` lives only in Supabase's secret store — it is never sent to the browser, never committed, never bundled.

## One-time deploy

Run these commands from the repo root (the directory containing `supabase/`):

```bash
# 1. Install Supabase CLI (one-time, on your Mac)
brew install supabase/tap/supabase

# 2. Log in (opens a browser)
supabase login

# 3. Link this repo to your Supabase project
#    Find your project ref at: https://supabase.com/dashboard/project/_/settings/general
supabase link --project-ref YOUR_PROJECT_REF

# 4. Set the Anthropic API key as a secret (NEVER commit this key)
#    Get one at: https://console.anthropic.com/settings/keys
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# 5. Deploy the function
supabase functions deploy suggest
```

That's it. The "AI Suggest" button in the app will start working immediately.

## Verifying

Test it from your terminal (replace YOUR_PROJECT_REF and YOUR_ANON_KEY):

```bash
curl -X POST \
  "https://YOUR_PROJECT_REF.supabase.co/functions/v1/suggest" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pool":[{"name":"Pushups","recent_sessions_30d":3,"recent_total_reps_30d":120,"last_done":"2026-05-01"}],"count":1,"recentLog":[]}'
```

You should get back something like `{"names":["Pushups"]}`.

## Updating the prompt or model

Edit `index.ts` and re-run `supabase functions deploy suggest`. Frontend code does not change.

## Rotating the key

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-NEW_KEY
```

No re-deploy needed; the function picks up the new value on the next invocation.
