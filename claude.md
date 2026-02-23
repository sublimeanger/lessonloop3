# Project context
- This is a Lovable-built web app (Vite + React). Backend: SUPABASE (if applicable).
- Goal: production-ready polish: zero console errors, stable auth, robust error handling, responsive UI, accessible forms, predictable loading/empty states, clean code, world class polish, complete cohesion between features.

# How to run
- Package manager: AUTO-DETECT (pnpm/yarn/npm) by checking lockfiles.
- Commands (read from package.json scripts first):
  - dev: (e.g. pnpm dev)
  - build: (e.g. pnpm build)
  - lint: (e.g. pnpm lint)
  - typecheck: (e.g. pnpm typecheck)
  - tests: (e.g. pnpm test)

# Quality gates (MUST pass before marking anything done)
- `lint`, `typecheck`, `tests` (if present), and `build` must all pass.
- No new TODOs, no console.log spam, no “any” types unless justified.
- Every bug fix includes: repro steps, root cause, fix, and a verification step (test or manual checklist).

# Workflow rules
- Use Plan Mode first for any change that touches multiple files.
- Make small, reviewable commits. One logical fix per commit.
- After each fix: rerun the smallest relevant command (then full build before finishing a session).
