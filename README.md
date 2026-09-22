# Mashanoch CBT

A computer-based testing app for Mashanoch Private Schools. Teachers write
tests, an admin approves them, and students sit them in the browser.

Built with Next.js (App Router) and Supabase (Postgres, Auth, Storage).

## Who does what

- **Students** sign in with their **admission number** and their **surname**
  as the password. They see only tests for their own class that an admin has
  approved and whose window is open. They do not see their scores.
- **Teachers** write tests and questions, submit them for approval, and read
  their own tests' results. They cannot approve anything.
- **Admins** manage staff, students and subjects, approve or send back tests
  with a note, and see every result.

A test only reaches students once an admin approves it. Any edit to an
approved test sends it back for approval, and once the first student starts,
the paper is frozen.

## Running it locally

1. `npm install`
2. Create `.env` in the project root:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server only, never shipped to the browser
   SUPABASE_PASSWORD=<database password>          # only for running migrations yourself
   NEXT_PUBLIC_SITE_URL=http://localhost:3000     # where invite and reset emails come back to
   ```

   The keys are in the Supabase dashboard under Project Settings → API.

3. `npm run dev`, then open http://localhost:3000

## The database

`supabase/migrations/` holds every change in order. Apply a new one by pasting
it into the Supabase SQL Editor and running it. Each file wraps its work in a
transaction, so it either applies fully or not at all, and each can be run
twice safely.

Read them in order to understand the rules: they hold the security, not the
app. In particular:

- `0002` — who can read and write what (row level security)
- `0003` — profile creation and server-side marking
- `0010` — the approval workflow
- `0011` — admins review tests, they never edit them
- `0012` — students cannot read their own score
- `0015` — a paper freezes when the first student starts; a signup cannot
  choose its own role

Question pictures live in a public Storage bucket called `question-images`.

## Supabase settings this app expects

- **Public signups: off.** Accounts are created by admins. (Since `0015` a
  signup could not make itself staff anyway, but leave them off.)
- **Email:** staff invites and password resets are emailed. Supabase's
  built-in sender only allows a few messages an hour, so set up your own SMTP
  before a real term.
- **Redirect URLs:** add `NEXT_PUBLIC_SITE_URL` + `/auth/callback` under
  Authentication → URL Configuration.

## The first admin

With no accounts yet, invite yourself from the command line:

```bash
node --env-file=.env scripts/invite-staff.mjs you@example.com "Your Name" admin
```

It emails an invitation, or prints a link if email isn't set up yet. Open it
and choose a password. After that, admins invite staff and add students from
the app.

## Times

Everything is Lagos time (`src/lib/time.ts`), whatever timezone the server
runs in, so a test set for 9:00 opens at 9:00 in Lagos even when hosted
abroad.

## Checks

```bash
npx tsc --noEmit    # types
npx eslint src      # lint
npm run build       # production build
```
