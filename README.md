# PaperVault

AI-powered research paper vault for Computer Science students. Search, upload, organize, and study research papers with AI-generated summaries, flashcards, and recommendations.

## Features

- **Paper Search** — search Semantic Scholar and arXiv directly from the app
- **PDF Upload** — upload your own PDFs (stored locally or in Supabase Storage)
- **AI Summarization** — auto-generate summaries, key points, and flashcards via Groq
- **Collections** — organize papers into custom collections
- **Status Tracking** — track reading progress (To Read / Reading / Done)
- **Code Links** — surfaces GitHub repositories linked to papers via Papers With Code
- **Recommendations** — AI-powered related paper suggestions
- **Reading Checklist** — per-paper task list with completion tracking
- **Offline Mode** — falls back to localStorage + IndexedDB when Supabase is unreachable
- **Dark Mode** — full dark/light theme support

## Tech Stack

- **Frontend** — React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend** — Supabase (Postgres, Auth, Storage, Edge Functions)
- **AI** — Groq API via Supabase Edge Functions
- **Offline** — localStorage + IndexedDB fallback

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/nabilanewaz/papervault.git
   cd papervault
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
   Fill in your Supabase URL and anon key.

4. Apply the database migrations in the Supabase SQL Editor:
   ```
   supabase/migrations/20260531000000_rls_policies.sql
   ```

5. Start the dev server:
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `GROQ_API_KEY` | Groq API key, set as a Supabase Edge Function secret (not a `VITE_` var — used only by `summarize-paper`) |

## Deployment

The app is deployed on [Vercel](https://vercel.com). Every push to `main` triggers an automatic deploy.

To deploy your own instance:
1. Import the repo into Vercel
2. Add the environment variables above in the Vercel dashboard
3. Deploy

## Edge Functions

The `summarize-paper` edge function handles AI summarization, key point extraction, flashcard generation, and paper search. It requires a `GROQ_API_KEY` secret to be set on the Supabase project before it will work:

```bash
supabase secrets set GROQ_API_KEY=your_groq_key_here --project-ref kcqibwhqnydcqzpwejsb
```

Then deploy it:

```bash
# Set your Supabase access token first
export SUPABASE_ACCESS_TOKEN=your_token_here
npm run deploy:functions
```
