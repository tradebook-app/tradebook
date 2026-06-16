# TRADEBOOK — Trading Journal

Professional trading journal built with Next.js 14, Supabase, and Vercel.

---

## Stack

| Layer       | Tech                        |
|-------------|-----------------------------|
| Framework   | Next.js 14 (App Router)     |
| Auth + DB   | Supabase (Postgres + Auth)  |
| Storage     | Supabase Storage            |
| Styling     | Tailwind CSS + CSS vars     |
| Charts      | Chart.js + react-chartjs-2  |
| Deploy      | Vercel                      |

---

## Phase 1 Setup — Do This Now

### Step 1 — Clone & install

```bash
cd tradebook
npm install
```

### Step 2 — Create Supabase project

1. Go to https://app.supabase.com
2. Click **New Project**
3. Name it `tradebook`, pick a strong DB password, choose a region close to you (US East recommended)
4. Wait ~2 minutes for it to provision

### Step 3 — Run the database schema

1. In Supabase dashboard → **SQL Editor** → **New Query**
2. Paste the entire contents of `supabase/migrations/001_initial_schema.sql`
3. Click **Run**
4. You should see "Success" — no errors

### Step 4 — Set environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Find these in Supabase → **Settings** → **API**:
- `URL` → copy the Project URL
- `anon public` key → copy the anon key (NOT the service_role key)

### Step 5 — Configure Supabase Auth

In Supabase Dashboard → **Authentication** → **URL Configuration**:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: add `http://localhost:3000/auth/callback`

### Step 6 — Run locally

```bash
npm run dev
```

Open http://localhost:3000 → you'll be redirected to `/login`.
Create an account → check email → confirm → you're in.

---

## Deploy to Vercel

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "init: TRADEBOOK phase 1"
git remote add origin https://github.com/YOUR_USERNAME/tradebook.git
git push -u origin main
```

### Step 2 — Connect to Vercel

1. Go to https://vercel.com → **New Project**
2. Import your GitHub repo
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

### Step 3 — Update Supabase Auth URLs for production

In Supabase → **Authentication** → **URL Configuration**:
- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: add `https://your-app.vercel.app/auth/callback`

---

## Project Structure

```
tradebook/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Redirects → dashboard or login
│   │   ├── globals.css             # Global styles + CSS vars
│   │   ├── login/page.tsx          # Login page
│   │   ├── signup/page.tsx         # Signup page
│   │   ├── auth/callback/route.ts  # Email confirmation handler
│   │   └── dashboard/
│   │       ├── page.tsx            # Server component (auth check)
│   │       └── DashboardClient.tsx # Client component (UI)
│   ├── components/
│   │   └── layout/
│   │       ├── AppShell.tsx        # Sidebar + Topbar wrapper
│   │       ├── Sidebar.tsx         # Navigation sidebar
│   │       └── Topbar.tsx          # Top bar + date filter
│   └── lib/
│       ├── types.ts                # All TypeScript types
│       ├── analytics.ts            # KPI + chart calculations
│       └── supabase/
│           ├── client.ts           # Browser client
│           ├── server.ts           # Server component client
│           └── middleware.ts       # Session refresh + route protection
├── middleware.ts                   # Next.js middleware
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Full DB schema + RLS
├── tailwind.config.js
├── next.config.js
└── .env.local.example
```

---

## Migration Roadmap

| Phase | Status | What gets built |
|-------|--------|-----------------|
| 1 | ✅ Done | Project scaffold, Supabase schema, Auth, App shell |
| 2 | Next | Trades CRUD + Trade View page |
| 3 | — | Dashboard (KPIs, charts, calendar) |
| 4 | — | Reports (6 subtabs) |
| 5 | — | Notebook + Strategies |
| 6 | — | Position Size calculator |
| 7 | — | DAS import + file uploads |
| 8 | — | JSON backup/restore + polish |
