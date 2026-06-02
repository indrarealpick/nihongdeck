# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nihongo Flash is a Japanese vocabulary flashcard PWA. One repo serves two deployments:
- **GitHub Pages** — serves all static files (`index.html`, icons, `manifest.json`, `service-worker.js`)
- **Vercel** — serves the `api/` folder as serverless functions

## Commands

There is no build step for the frontend. `index.html` is deployed as-is.

**Backend (Vercel serverless):**
```bash
npm install              # install openai SDK
vercel dev               # run api/ locally (requires Vercel CLI + OPENROUTER_API_KEY env var)
```

**Test the API endpoint:**
```bash
curl -X POST http://localhost:3000/api/japanese \
  -H "Content-Type: application/json" \
  -d '{"word":"食べる"}'
# Expected: {"reading":"たべる","meaning":"Makan"}
```

## Architecture

### Frontend (`index.html`)

The entire frontend is a single self-contained HTML file with no bundler, no npm, no framework. It loads Supabase JS SDK from CDN.

**Global state:** A single `State` object holds `user`, `profile`, `categories`, `flashcards`, and study session data. All mutations go through the async CRUD functions in the "DATA LAYER" section.

**Navigation model:** The app has named `<section id="screen-*">` elements. `goto(screen)` shows the correct screen, sets the active nav item, and calls the appropriate `render*()` function. `show(screen)` only toggles visibility without triggering renders.

**Data flow pattern:** CRUD functions (`createFlashcard`, `updateCategory`, etc.) write to Supabase and mutate the in-memory `State` arrays directly — there is no re-fetch after writes. `refreshAll()` re-renders every screen from the current `State`.

**AI integration:** `fetchJapanese(word)` posts to `CONFIG.API_URL` with a 20-second client-side timeout. On failure, `manualFallback()` is called so the user can enter reading/meaning manually.

**CONFIG block** (near top of `<script>`): The three values `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `API_URL` must be set before deploying.

### Backend (`api/japanese.js`)

Vercel Serverless Function (ESM). Uses the OpenAI SDK pointed at OpenRouter (`baseURL: 'https://openrouter.ai/api/v1'`). The model is `openai/gpt-4.1` — change the `MODEL` constant to switch models.

Required environment variable on Vercel: `OPENROUTER_API_KEY`.  
Optional: `APP_URL` (used as `HTTP-Referer` header for OpenRouter).

The function instructs the model to return only `{"reading":"","meaning":""}` JSON and handles malformed responses by regex-extracting the first JSON object from the raw text.

### Database (Supabase)

Three tables: `profiles`, `categories`, `flashcards`. All have RLS policies restricting every user to their own rows via `auth.uid() = user_id`.

A `handle_new_user` trigger on `auth.users` auto-creates a profile row on signup. `ensureProfile()` in the frontend is a safety fallback in case the trigger doesn't fire.

Flashcard `status` is an enum-like text column constrained to `'belum_hafal'` or `'hafal'`.

### PWA

`service-worker.js` caches the app shell on install (cache-first for assets, network-first for navigation). API calls to `/api/`, Supabase, and OpenAI hostnames are always passed through to the network without caching.

When bumping the service worker cache (e.g., after static asset changes), increment the `CACHE` version string in `service-worker.js`.

## Design System

All UI follows a **Neubrutalism** style defined by CSS custom properties in `:root`. Key conventions:
- `.nb` class = white card with 4px black border + 6px offset box shadow
- `.btn` variants: `btn-primary` (yellow), `btn-secondary` (coral/red), `btn-accent` (teal), `btn-danger` (red), `btn-ghost` (white)
- Shadows: `--shadow-sm` (4px), `--shadow-md` (6px), `--shadow-lg` (8px) — all solid black offset, no blur
- Japanese text uses `var(--font-jp)` (`Noto Sans JP`)
- Active press state on buttons: `transform: translate(4px,4px); box-shadow: none`
- The `esc()` helper must be used on all user-supplied data inserted into innerHTML to prevent XSS
