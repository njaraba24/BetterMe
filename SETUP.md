# Better Me — Local Dev + Supabase + Vercel Setup

This guide walks you through:
1. Getting the code running in VS Code
2. Setting up your own Supabase project (database, auth, RLS)
3. Deploying to Vercel

---

## 1. Prerequisites

Install these once:

- **Node.js 20+** — https://nodejs.org
- **Bun** (package manager used by this project) — https://bun.sh (`curl -fsSL https://bun.sh/install | bash`)
- **Git** — https://git-scm.com
- **VS Code** — https://code.visualstudio.com
- **Supabase CLI** — https://supabase.com/docs/guides/local-development/cli/getting-started
  - macOS: `brew install supabase/tap/supabase`
  - Windows: `scoop install supabase`
- **Vercel CLI** (optional, for CLI deploys) — `npm i -g vercel`

Recommended VS Code extensions:
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript Vue Plugin (Volar) is NOT needed — this is React

---

## 2. Get the code

If you haven't pushed to GitHub yet, use the **GitHub** button in the Lovable editor (top bar) to create a repo, then:

```bash
git clone https://github.com/<your-user>/<your-repo>.git
cd <your-repo>
code .
bun install
```

---

## 3. Set up your own Supabase project

The project currently points at a Lovable-managed Supabase instance. To self-host you need your own project.

### 3.1 Create the project

1. Go to https://supabase.com → **New project**.
2. Pick a region close to your users. Save the **database password** in a password manager.
3. Once ready, open **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **anon public key** (`eyJ...`)
   - **service_role key** (`eyJ...`) — keep this secret, server-only.
4. From **Project Settings → General**, copy the **Project Ref** (the `xxxx` in the URL).

### 3.2 Apply the database schema

All schema, RLS policies, and functions live in `supabase/migrations/`. Push them to your new project:

```bash
# Log in to Supabase CLI
supabase login

# Link this repo to your project (use the ref from step 3.1)
supabase link --project-ref <your-project-ref>

# Push all migrations
supabase db push
```

This creates every table (`profiles`, `habits`, `habit_logs`, `tasks`, `goals`, `finance_entries`, `journal_pages`, `journal_shares`, `friendships`), the RLS policies, and the RPC functions (`has_role`, `are_friends`, `get_user_xp`, `get_friends_leaderboard`, `find_user_id_by_email`, `handle_new_user`).

> If `db push` complains about existing objects, your project isn't empty — reset it from the Supabase dashboard (**Database → Reset**) and re-run.

### 3.3 Configure Auth

In the Supabase dashboard:

1. **Authentication → Providers → Email**: enabled (default).
2. **Authentication → URL Configuration**:
   - **Site URL**: your production URL (e.g. `https://better-me.vercel.app`)
   - **Redirect URLs**: add both `http://localhost:8080` and your Vercel URL (and any preview URL pattern like `https://*.vercel.app`).
3. **Authentication → Providers → Email → Confirm email**: **disable** for the MVP (matches current behavior) so signups don't need email verification. Turn it back on later for production.
4. **Authentication → Policies**: Leaked-password protection — enable if you want HIBP checks.

### 3.4 Regenerate the TypeScript types (optional but recommended)

```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

---

## 4. Environment variables

Create a `.env` file in the project root (this file is gitignored):

```bash
# Client-visible (Vite)
VITE_SUPABASE_URL="https://<your-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<your-anon-key>"
VITE_SUPABASE_PROJECT_ID="<your-ref>"

# Server-only (used by TanStack server functions)
SUPABASE_URL="https://<your-ref>.supabase.co"
SUPABASE_PUBLISHABLE_KEY="<your-anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"

# AI features (task natural-language quick-add). Get a key from https://lovable.dev
# or swap the fetch in src/lib/tasks.functions.ts for OpenAI/Gemini directly.
LOVABLE_API_KEY="<optional — leave blank to disable AI quick-add>"
```

> The `VITE_*` variables are baked into the browser bundle at build time. The unprefixed ones stay server-side.

---

## 5. Run it locally

```bash
bun run dev
```

Open http://localhost:8080. Sign up at `/auth`, then explore Habits, Tasks, Goals, Finance, Journal.

Useful scripts:
- `bun run dev` — dev server
- `bun run build` — production build
- `bun run start` — run the built app

---

## 6. Deploy to Vercel

This project uses **TanStack Start** with a Nitro build. The default template targets Cloudflare Workers, so we need to switch the target to **Vercel** before deploying.

### 6.1 Switch the Nitro preset to Vercel

Edit `vite.config.ts`:

```ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "vercel-edge", // or "vercel" for Node runtime
  },
});
```

Then rebuild once locally to make sure it works: `bun run build`.

### 6.2 Push to GitHub

Make sure your repo is on GitHub (or GitLab/Bitbucket).

### 6.3 Import in Vercel

1. https://vercel.com/new → **Import** your repo.
2. **Framework Preset**: *Other* (Vercel will auto-detect Vite/Nitro output).
3. **Build Command**: `bun run build`
4. **Install Command**: `bun install`
5. **Output Directory**: leave default (Nitro's Vercel preset writes to `.vercel/output`).
6. **Environment Variables** — add all of these (from your `.env`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `LOVABLE_API_KEY` (optional)
7. Click **Deploy**.

### 6.4 Post-deploy

- Copy your Vercel URL (e.g. `https://better-me.vercel.app`) into **Supabase → Auth → URL Configuration** (Site URL + Redirect URLs).
- Re-deploy if you changed env vars after the first build.

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `Missing Supabase environment variable(s)` | `.env` not loaded — restart dev server after editing. |
| `Expected 3 parts in JWT; got 1` | You put a `sb_publishable_...` key where a JWT anon key belongs. Use the `eyJ...` anon key. |
| Sign-in works but data is empty | RLS is doing its job — you're a different user than the seed data. Sign up fresh. |
| `db push` fails on migrations | Reset the DB from the Supabase dashboard and re-run `supabase db push`. |
| Vercel build fails on `sharp`/native deps | You picked `vercel-edge` but some dependency needs Node. Switch preset to `vercel`. |
| Auth redirect loops after Vercel deploy | Site URL / Redirect URLs in Supabase Auth don't include your Vercel domain. |

---

## 8. What lives where

- `src/routes/` — TanStack file-based routes (pages).
- `src/routes/_authenticated/` — protected pages (require login).
- `src/components/` — shared React components.
- `src/lib/` — utilities, auth context, server functions (`*.functions.ts`).
- `src/integrations/supabase/` — auto-generated Supabase client + types. **Don't edit by hand.**
- `supabase/migrations/` — SQL migrations, run in order.

Enjoy self-hosting Better Me 🎉
