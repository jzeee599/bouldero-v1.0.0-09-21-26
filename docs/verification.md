# Milestone 1 verification

## Automated checks

- `pnpm typecheck`: passed.
- `pnpm build`: passed with Next.js 16.3.5 in Webpack mode, including static generation of `/` and `/manifest.webmanifest`.
- Playwright Chromium: **4 tests passed**.
  - 15 holds saved, page reloaded, project reopened, and marker alignment checked at phone, desktop, landscape, and 320px widths.
  - Dragging, keyboard movement, bounds clamping, delete/reorder, undo, and TOP behavior.
  - Required-field validation and recovery from a simulated storage failure.
  - Invalid-image error handling.

The Vercel build uses Node.js 22 through `package.json`. The development machine currently provides Node.js 24, so local pnpm prints an engine warning; compilation and tests still pass. Vercel will not show that mismatch.

## Remaining acceptance checks

- Upload a real photo taken by the target iPhone; confirm its orientation and manually check hold alignment after closing/reopening.
- Configure a Supabase project, apply the migration, and perform a cloud save/reopen round trip.
- Use a second anonymous identity to confirm database and Storage owner isolation against the deployed policies.
- Test route photos with closely spaced holds and touches with an actual finger.

These checks cannot be replaced by synthetic browser fixtures. Attempt logging and later milestones are not started.
