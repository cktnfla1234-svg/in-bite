# In-Bite Auth + Supabase Setup Checklist

This guide completes the Clerk + Supabase onboarding flow used by this app.

## 0) Prerequisites

- You already have a Supabase project.
- You already have a Clerk application.
- App runs locally from `http://localhost:5173`.

## 1) Environment Variables

Create `.env` in project root (or copy from `.env.example`) and set:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Check if all required keys exist:

```bash
npm run check:env
```

## 2) Supabase Table + RLS

1. Open Supabase SQL editor.
2. Run the SQL in `supabase_profiles.sql`.
3. Confirm table exists: `public.profiles`.
4. Confirm RLS is enabled and policies are created:
   - `profiles_select_own`
   - `profiles_insert_own`
   - `profiles_update_own`

Expected profile fields include:

- `clerk_id`, `email`, `first_name`, `last_name`, `image_url`
- `current_tastes` (text array)
- `onboarding_completed` (boolean)
- `bites_balance` (defaults to 5)
- `welcome_bonus_granted` (defaults to true)

## 3) Clerk Social Login Setup

In Clerk Dashboard:

1. Go to **User & Authentication** -> **Social Connections**.
2. Enable:
   - Kakao
   - Naver
3. Set provider client id/secret as requested by Clerk UI.
4. Ensure callback URLs shown by Clerk are registered in Kakao/Naver developer console.

## 4) Clerk JWT Template for Supabase

In Clerk Dashboard:

1. Go to **JWT Templates**.
2. Create template named exactly: `supabase`
3. Ensure the JWT **`sub` (subject) claim is the Clerk user id** — the same string as `user.id` from `@clerk/clerk-react` / Dashboard → Users → a user → **User ID** (often looks like `user_...`).  
   This app’s RLS and inserts assume:

   - `public.profiles.clerk_id` = that Clerk user id  
   - `public.daily_bites.author_clerk_id` = that Clerk user id  
   - Supabase evaluates policies as `auth.jwt()->>'sub' = clerk_id` (or `author_clerk_id`)

   Clerk’s default JWT template claims include `sub` for the signed-in user; **do not** override `sub` with a different value (e.g. email or internal numeric id).

4. Save template.

This app calls:

- `getToken({ template: "supabase" })`

without this template, profile sync cannot write to Supabase.

### 4.1) Repo check (what the code assumes)

These must all use the **same** Clerk user id string:

| Place | Field / API |
| --- | --- |
| `src/lib/profile.ts` | `upsert` / `update` / `select` on `profiles` with `clerk_id: user.id` |
| `src/lib/remoteDailyBites.ts` | `author_clerk_id` on insert; `eq("author_clerk_id", clerkId)` on “my posts” |
| `src/app/components/*` | `getToken({ template: "supabase" })` and `user.id` for ownership |

So **`jwt.sub` must equal `user.id`** from Clerk for RLS to allow reads/writes tied to that row.

### 4.2) How you can verify (2 minutes, in your dashboards)

1. **Clerk** — JWT Templates → open **`supabase`** → confirm the payload still exposes standard **`sub`** (Clerk user id). If you use a custom body, include nothing that replaces `sub` with another identifier.
2. **Signed-in app (local dev)** — After login, in DevTools console you can decode the middle segment of the JWT from `getToken({ template: "supabase" })` (base64url JSON) and read `"sub"`. It must match **`user.id`** in React and the **`clerk_id`** column for your row in `public.profiles`.
3. **Supabase** — Table Editor → `profiles` → your row: `clerk_id` text must equal that same `sub` value.

If `sub` ≠ `profiles.clerk_id`, RLS will reject updates even when the user is logged in.

### 4.3) Newer Clerk + Supabase option (optional)

Supabase now documents **Third-Party Auth with Clerk** (session tokens + Supabase dashboard integration) as the recommended path; the older **JWT template + Supabase JWT secret** flow is still usable but labeled deprecated. This repo currently uses **`getToken({ template: "supabase" })`** (template path). Migrating to third-party auth would require coordinated Clerk + Supabase dashboard changes and client token wiring — not required for the contract above as long as `sub` matches `clerk_id`.

## 5) Run + Verify Locally

1. Start app:

```bash
npm run dev
```

2. Open:

- `http://localhost:5173/`

3. Verify flow:

- Welcome modal appears.
- `Sign Up & Get 5 BITEs` shows auth options.
- Social login redirects and returns.
- After first signup, user goes to taste onboarding.
- After selecting tastes, user enters `/app`.

## 6) Data Verification in Supabase

After successful signup, inspect `public.profiles`:

- A row with `clerk_id` is created automatically.
- `bites_balance = 5`
- `welcome_bonus_granted = true`
- `current_tastes` gets filled after onboarding submission.
- `onboarding_completed = true` after onboarding is saved.

## Production (Vercel)

배포 URL에서만 동작이 깨질 때는 **Vercel Production 환경 변수**, **Clerk JWT 템플릿 `supabase`**, **Supabase RLS SQL**을 순서대로 점검합니다.

→ **[VERCEL_PRODUCTION_CHECKLIST.md](./VERCEL_PRODUCTION_CHECKLIST.md)** (한국어 단계별 가이드)

## 7) Troubleshooting

- White screen on auth pages:
  - Check `VITE_CLERK_PUBLISHABLE_KEY` exists.
- Login works but profile row not created:
  - Verify JWT template name is `supabase`.
  - Verify Supabase URL/anon key.
  - Verify RLS policies were created.
- Social button click does nothing:
  - Provider not enabled in Clerk or missing provider credentials.
