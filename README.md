# Mashanoch CBT

Computer-based testing for Mashanoch Private Schools. Teachers write tests, an
administrator approves them, and students sit them in a browser on any device.

Live at **https://cbt.mashanochprivateschools.com**

Built with Next.js (App Router, Server Actions) and Supabase (Postgres, Auth,
Storage). The database — not the application — is where the rules live: row
level security, column grants and triggers enforce who may read and write what,
so a bug in a page cannot leak an answer key or a score.

---

## Contents

- [How it works](#how-it-works)
- [Who can do what](#who-can-do-what)
- [The life of a test](#the-life-of-a-test)
- [Running it locally](#running-it-locally)
- [Environment variables](#environment-variables)
- [Database migrations](#database-migrations)
- [Supabase configuration](#supabase-configuration)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Design decisions](#design-decisions)
- [Checks](#checks)

---

## How it works

**Students** sign in with their **admission number** and their **surname** as
the password — no email address, nothing to remember. They see only approved
tests for their own class whose window is open. Each student's clock starts
when they open the paper and is capped by the closing time; answers save as
they go, and the test submits itself when time runs out.

**Teachers** write tests and questions (with optional pictures), submit them
for approval, and read the results of their own tests.

**Administrators** manage staff, students and subjects, approve tests or send
them back with a note, and see every result in the school.

Students never see their scores in the app: results are a staff view, printed
or read out as the school chooses.

## Who can do what

| | Students | Teachers | Admins |
| --- | --- | --- | --- |
| Sit tests | ✅ | — | — |
| See own score | ❌ | — | — |
| Write and edit tests | — | Own only | ❌ |
| Delete a test | — | Own, before anyone sits it | ❌ |
| Approve / send back | — | ❌ | ✅ |
| See results | ❌ | Own tests | All tests |
| Manage accounts and subjects | — | ❌ | ✅ |

Admins deliberately cannot edit tests. An approval means nothing if the
approver can also change the paper, so writing and approving stay separate —
enforced in `src/lib/auth.ts` and again by database policy (`0011`).

## The life of a test

```
draft ──submit──▶ pending ──approve──▶ approved ──window opens──▶ live ──▶ closed
  ▲                  │                    │
  └──── any edit ◀───┴── changes requested┘
```

- A test reaches students only once an **admin approves it** and its window
  opens.
- **Any edit to a pending or approved test sends it back to draft**, so what an
  admin approved is always what students get.
- **The paper freezes when the first student starts it.** Before that, even a
  live test can be corrected.
- Every submission, decision and comment is kept in a review thread that both
  the teacher and the admins read.

## Running it locally

```bash
npm install
cp .env.example .env     # then fill in the values below
npm run dev              # http://localhost:3000
```

With no accounts yet, invite yourself as the first administrator:

```bash
node --env-file=.env scripts/invite-staff.mjs you@example.com "Your Name" admin
```

It emails an invitation, or prints a link if email isn't configured yet. Open
it, choose a password, and from then on accounts are managed inside the app.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key; safe in the browser, RLS protects the data |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Bypasses RLS entirely — never expose it to the browser |
| `NEXT_PUBLIC_SITE_URL` | Where invite and password-reset emails return to |
| `SUPABASE_PASSWORD` | Direct Postgres password; only for applying migrations |

The service-role key is used in Server Actions and server components for the
paths the database deliberately denies to signed-in users: reading the answer
key, provisioning accounts, reading scores. Every such call checks
authorisation first (see `requireTestOwner`, `requireAdmin`).

## Database migrations

`supabase/migrations/` holds every change in order. Apply one by pasting it
into the Supabase SQL Editor and running it, or with psql:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0015_lock_on_first_start_and_signup_role.sql
```

Each file wraps its work in a transaction and can be applied twice safely.

| Migration | What it establishes |
| --- | --- |
| `0001`–`0002` | Schema hardening, row level security, column grants |
| `0003` | Profile creation on signup, server-side marking |
| `0004`–`0007` | Student-safe views, anon lockdown, answer saving |
| `0008` | Questions freeze once a test has begun |
| `0009` | Term and academic session |
| `0010` | Approval workflow and the review thread |
| `0011` | Admins review tests, never edit them |
| `0012` | Students cannot read their own score |
| `0013`–`0014` | First/last names; the surname becomes the password |
| `0015` | Freeze on first start; a signup cannot choose its own role |

Read them in order to understand the security model — they hold the rules, and
the application merely respects them.

## Supabase configuration

- **Public signups: off.** Accounts are created by administrators. Since `0015`
  a signup cannot grant itself a staff role, but leave signups disabled.
- **Redirect URLs:** add `<NEXT_PUBLIC_SITE_URL>/auth/callback` under
  Authentication → URL Configuration, and set the Site URL to match.
- **SMTP:** Supabase's built-in sender allows only a few messages an hour.
  Configure your own (the school uses Resend) before inviting staff in bulk.
- **Email templates:** paste the two files in `supabase/email-templates/` into
  Authentication → Emails → Templates. Subjects are listed in that folder's
  README.
- **Storage:** a public bucket named `question-images` holds question pictures,
  limited to 2 MB and image types.

## Deployment

Hosted on Vercel; pushing to `main` deploys. Set the five environment variables
in the project settings (the service-role key as a sensitive value), and point
the domain at Vercel with a CNAME:

```
cbt    CNAME    cname.vercel-dns.com
```

A CNAME rather than an A record: it follows Vercel's current addresses instead
of pinning one, which matters on networks that cannot route to every IP.

## Project structure

```
src/
  app/
    login/              Student sign-in (admission number + surname)
    staff/              Staff sign-in, invitation, password reset
    exam/               Sitting a test: runner, timer, auto-submit
    teacher/            Writing tests, questions, submitting for approval
    admin/              Staff, students, subjects, approvals, results
    print/              Printable student lists and results (no app shell)
    auth/callback/      Invite and reset links land here
  components/           Shell, navigation, shared UI primitives
  lib/
    auth.ts             Role and ownership guards used by every action
    test-status.ts      One definition of draft/pending/approved/live/locked
    time.ts             Everything is Lagos time, whatever the server's zone
    student-password.ts Surname → the password Auth actually stores
    supabase/           Browser, server and service-role clients
supabase/
  migrations/           The database, in order
  email-templates/      Invitation and password-reset emails
scripts/
  invite-staff.mjs      Bootstrap the first administrator
```

## Design decisions

**Students have no email address.** Supabase Auth requires one, so it is
synthesised from the profile's UUID — never from the admission number — which
is what lets an admission number be corrected later without recreating the
account.

**The surname is the password.** The school's choice: easy for young students,
nothing to lose or reset. It is weak by design, so sitting a test is supervised
and an admission number alone is not enough to be useful.

**Everything is Lagos time.** A server in another timezone would otherwise open
a 9:00 test at 10:00. `src/lib/time.ts` parses and formats in `Africa/Lagos`
regardless of where the app runs.

**Scores are not readable by the browser.** `0012` revokes the column from
signed-in users and stops `submit_test` returning a score, so a student cannot
read their mark even by calling the API directly.

**Question order is fixed.** Every student sees the same order — a deliberate
choice by the school.

## Checks

```bash
npx tsc --noEmit    # types
npx eslint src      # lint
npm run build       # production build
```
