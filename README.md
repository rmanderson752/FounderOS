# Founder OS

Your startup command center. Track priorities, runway, metrics, and pipeline in one place.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **State:** React Query (TanStack)
- **Hosting:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase account (free tier works)

### 1. Clone and Install

```bash
git clone <your-repo>
cd founder-os
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings > API** and copy your:
   - Project URL
   - Anon/Public key

3. Create `.env.local`:
```bash
cp .env.example .env.local
```

4. Add your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run Database Migration

1. Go to Supabase Dashboard > SQL Editor
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Run the SQL

### 4. Configure Auth (Optional: Google OAuth)

1. Go to Supabase Dashboard > Authentication > Providers
2. Enable Google provider
3. Add your Google OAuth credentials
4. Add redirect URL: `http://localhost:3000/auth/callback`

### 5. Start Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth pages (login, signup)
│   ├── (dashboard)/       # Dashboard pages
│   ├── onboarding/        # Onboarding flow
│   └── auth/callback/     # OAuth callback
├── components/
│   ├── ui/                # Reusable UI components
│   ├── dashboard/         # Dashboard widgets
│   └── ...                # Feature components
├── lib/
│   ├── supabase/          # Supabase clients
│   ├── api/               # API functions
│   └── utils/             # Utility functions
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript types
```

## Features

- **Daily Priorities:** Track your top 3 priorities each day
- **Runway Calculator:** Always know your financial runway
- **Key Metrics:** Track the numbers that matter
- **Pipeline Tracker:** Manage investors, customers, and hires
- **Weekly Reflections:** Structured end-of-week reviews

## Design System

The app uses a dark-mode-first design inspired by Linear and Vercel:

- **Background:** Near-black (#0A0A0B)
- **Cards:** Dark gray (#141417)
- **Accent:** Blue (#3B82F6)
- **Typography:** Inter font

See `src/app/globals.css` for the full design system.

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

### Environment Variables for Production

```
NEXT_PUBLIC_SUPABASE_URL=your-production-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-key
```

## License

MIT
