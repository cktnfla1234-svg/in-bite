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
3. Keep `sub` claim (required by current Supabase RLS policy: `auth.jwt()->>'sub' = clerk_id`).
4. Save template.

This app calls:

- `getToken({ template: "supabase" })`

without this template, profile sync cannot write to Supabase.

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

## 7) Troubleshooting

- White screen on auth pages:
  - Check `VITE_CLERK_PUBLISHABLE_KEY` exists.
- Login works but profile row not created:
  - Verify JWT template name is `supabase`.
  - Verify Supabase URL/anon key.
  - Verify RLS policies were created.
- Social button click does nothing:
  - Provider not enabled in Clerk or missing provider credentials.
