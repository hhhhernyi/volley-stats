# VolleyStat

Volleyball player statistics comparison dashboard — personal portfolio + analysis tool.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Supabase** (Postgres) — raw counts data model
- **TanStack Query** — client-side data layer
- **Chart.js** via `react-chartjs-2` — radar charts
- **Tailwind CSS** + **shadcn/ui**
- **Vercel** deploy target

## Pages

- `/compare` — pick 2 players × seasons, stat table + position radars, overlay toggle, club/NT source selector
- `/all-stats` — sortable/filterable leaderboard; columns adapt by position group

## Setup

```bash
# 1. Install deps
npm install

# 2. Configure Supabase
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Run migration in Supabase SQL editor
#    Paste contents of: supabase/migrations/001_schema.sql

# 4. Seed mock data (requires SUPABASE_SERVICE_ROLE_KEY in .env.local)
npm run seed

# 5. Start dev server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
