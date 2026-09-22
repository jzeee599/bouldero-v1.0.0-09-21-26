# Bouldero

A quiet, mobile-first climbing notebook. **Milestone 1 only:** upload a route photo, map holds, save, and reopen.

## Run locally

Requires Node.js 20.9+ and pnpm.

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. Without Supabase settings, the app clearly labels local mode and persists projects/photos in IndexedDB in this browser. There are no seeded projects or made-up attempts.

## Connect Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/001_projects.sql` in its SQL editor (once), or apply with the Supabase CLI.
3. Enable **Authentication → Sign In / Providers → Anonymous Sign-Ins**.
4. Copy `.env.example` to `.env.local` and set the project URL and **publishable** key. Never use a secret/service-role key.
5. Restart the development server. The footer changes to “Private cloud workspace.”

New projects now use private Supabase Storage and Postgres. Local projects are not silently migrated. Anonymous identity persists in this browser; clearing its auth storage loses access to that identity. Account recovery and cross-device sign-in are out of this milestone's scope. For public deployment, configure Supabase's recommended anonymous-auth abuse protection.

## Use

Choose **New project**, upload/take a photo, and tap holds from start to finish. Drag to reposition; select a marker and delete it, or undo the latest marker. Keyboard users can focus markers and nudge using arrows (Shift for larger steps). Optionally mark the final hold TOP, enter a name, and save. Return to projects or reload to reopen the saved map.

Attempt logging, sends, session grouping, and progress history are intentionally deferred. The saved route screen is a mapping preview, not the later live logging screen.

## Verify

```sh
pnpm typecheck
pnpm build
pnpm exec playwright install chromium
pnpm test
```

Tests exercise the browser upload/save/reload flow, 15-marker alignment at multiple sizes, dragging, deletion, TOP handling, validation and failed-save recovery. See [architecture and acceptance risks](docs/architecture.md) and [verification notes](docs/verification.md).

## Deploy

This repository is configured for Vercel with Node.js 22 and an exact, frozen dependency lockfile. Vercel detects the pnpm lockfile and Next.js preset automatically.

The scripts use Next.js's supported Webpack mode. This keeps local development stable when `node_modules` lives outside the iCloud-synced Documents folder; Vercel runs the same production build command.

1. Push this directory to a GitHub repository.
2. In Vercel, select **Add New → Project**, import the repository, and keep the detected Next.js defaults.
3. For device-local testing, leave the Supabase variables unset and deploy. Each phone/browser stores its own projects in IndexedDB.
4. For shared cloud data, first apply `supabase/migrations/001_projects.sql`, enable anonymous sign-ins, then add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in **Project Settings → Environment Variables** for Production, Preview, and Development.
5. Deploy, open the generated HTTPS URL in iPhone Safari, and optionally use **Share → Add to Home Screen**.

No Vercel build-command, output-directory, or install-command override is needed. HTTPS supports the intended phone experience. The manifest provides standalone launch metadata; offline loading/background sync are not implemented.
