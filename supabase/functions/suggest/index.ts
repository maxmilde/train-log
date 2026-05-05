// Supabase Edge Function: suggest
// Calls Anthropic API server-side so the API key is never exposed to the client.
//
// Deployment:
//   supabase functions deploy suggest --no-verify-jwt=false
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Invoked from frontend via:
//   const { data, error } = await supabase.functions.invoke('suggest', {
//     body: { pool, count, recentLog }
//   })
//
// Returns: { names: string[] }

// @ts-ignore -- Deno standard library import (resolved at deploy time)
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const { pool, count, recentLog } = await req.json()
    if (!Array.isArray(pool) || pool.length === 0) {
      return json({ error: 'pool is required and must be a non-empty array' }, 400)
    }
    if (!count || count < 1) {
      return json({ error: 'count is required and must be >= 1' }, 400)
    }

    // @ts-ignore Deno global available at runtime
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return json({ error: 'ANTHROPIC_API_KEY is not set in Supabase secrets' }, 500)
    }

    const prompt =
`You are suggesting ${count} kettlebell/bodyweight exercises for the user's next workout.

Selected exercise pool (with recent usage stats):
${JSON.stringify(pool, null, 2)}

Recent workouts (last 5 sessions):
${JSON.stringify(recentLog ?? [], null, 2)}

Pick exactly ${count} exercises from the pool above. Prioritize:
1. Exercises the user has done LESS RECENTLY or LESS OFTEN
2. Variety — try not to pick exercises that hit identical movement patterns
3. Balance push/pull/squat/hinge/carry where possible

Respond with ONLY a JSON array of exercise names (strings), no commentary. Example: ["Pushups", "Long Cycle", "Pullups"]`

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!anthropicRes.ok) {
      const txt = await anthropicRes.text()
      return json({ error: `Anthropic error (${anthropicRes.status}): ${txt}` }, 502)
    }

    const data = await anthropicRes.json()
    const text = data?.content?.[0]?.text ?? '[]'
    const match = text.match(/\[[\s\S]*?\]/)
    if (!match) {
      return json({ error: 'AI response not parseable', raw: text }, 502)
    }
    const names = JSON.parse(match[0])
    if (!Array.isArray(names)) {
      return json({ error: 'AI did not return an array' }, 502)
    }

    return json({ names })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
