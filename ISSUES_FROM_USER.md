Priority-ranked issues reported by the user

Summary
-------
This file records the problems and feature requests the user reported, organized and ranked by importance with reproduction notes, error snippets, and suggested next steps. Use these as-is to create GitHub issues or paste into an issue tracker.

Checklist of reported items
- [ ] Search returning 500 and search backend choice UX
- [ ] Meilisearch admin page runtime error (toLocaleString)
- [ ] Database-status page: dark-mode styling, missing import_progress table error, and missing import status display
- [ ] Front page dark-mode styling (white panels / "Export & API" text color)
- [ ] Put ingest page behind admin access
- [ ] Feature request: Re-add Elasticsearch
- [ ] Database import appears slow (performance)

Issues (ranked)

1) Critical: Search API returns 500 and backend search-source selection problematic
————————————————————————————————————
Priority: P0 (blocks core functionality)
Description:
- When performing searches the frontend receives: "Request failed with status code 500".
- The search UI still exposes a choice between Meilisearch and Database(Postgres) which should be clarified or hidden if one is not supported/healthy.

Reproduction:
1. Open the app and use the search box.
2. Observe 500 error in frontend/network or app UI.

Relevant logs / errors:
- Frontend message: "Request failed with status code 500" (no stacktrace shown in report).

Suggested next steps / likely causes:
- Check backend search endpoints (routes in `backend/src` or `backend/src/routes`) for unhandled exceptions and inspect server logs when performing a search.
- Verify Meilisearch connection config and Postgres fallback path. If Meilisearch is down, the backend should return a 4xx or a friendly message, not a 500, or fallback gracefully.
- Hide the UI toggle for search backend unless both are known good.

Suggested labels: bug, backend, high-priority, search

---
2) High: Meilisearch admin page throws runtime TypeError reading `toLocaleString`
————————————————————————————————————
Priority: P1
Description:
- The `meilisearch-admin` page is non-functional and throws: "Cannot read properties of undefined (reading 'toLocaleString')".
- The stacktrace points to `MeilisearchAdminPage` in the frontend bundle.

Reproduction:
1. Navigate to the Meilisearch Admin page.
2. Observe the runtime error and a crash overlay in development or console errors in production.

Error snippet (from user report):
TypeError: Cannot read properties of undefined (reading 'toLocaleString')
    at MeilisearchAdminPage (...) 

Suggested next steps / likely causes:
- Inspect the component `frontend/src/pages/MeilisearchAdminPage.tsx` for code that calls `.toLocaleString()` on a possibly undefined value (likely a Date or timestamp field from API response).
- Add safe guards (optional chaining, null checks) and fallback UI while data is loading.
- Add tests for the component with missing/undefined fields.

Suggested labels: bug, frontend, P1

---
3) High: Database-status page errors — missing `import_progress` table & UI issues
————————————————————————————————————
Priority: P1
Description:
- The `database-status` page shows incorrect styling in dark mode (white panels) and a strange layout.
- The page doesn't display database import status and backend errors show a missing table:

Error snippet (from user):
(sqlalchemy.dialects.postgresql.asyncpg.ProgrammingError) <class 'asyncpg.exceptions.UndefinedTableError'>: relation "import_progress" does not exist [SQL: INSERT INTO import_progress ...]
- The user reports the database import process appears slow; consider profiling the import path and measuring per-file latency and DB insert throughput.

Reproduction:
1. Visit the database-status page.
2. Observe layout/style issues and watch server logs for the SQL error when import progress is being written.

Suggested next steps / likely causes:
- The missing `import_progress` table indicates a migration was not applied. Check `backend/migrations/` for migration that creates `import_progress` and apply it (or run init SQL). Confirm migration numbering and run migration tooling used by the project.
- For dark-mode UI: inspect `frontend/src/pages/DatabaseStatusPage` (or similar) and tailwind/dark-mode classes; panels probably use hard-coded `bg-white` instead of using `bg-neutral-900/800` or `bg-surface` tokens.
- Ensure API call that gathers import status handles the case where import tracking is absent and falls back gracefully.

Suggested labels: bug, backend, frontend, database, P1

---
4) Medium: Front page dark-mode issues — white panels and black "Export & API" text
————————————————————————————————————
Priority: P2
Description:
- The front page still shows white panels in dark mode; some text ("Export & API") is black in dark mode making it unreadable.

Reproduction:
1. Enable dark mode and open the front page.
2. Inspect panels and the "Export & API" text color.

Suggested next steps:
- Audit CSS classes and shared theme tokens used on the front page. Replace `text-black` / `bg-white` with theme-aware classes (e.g., `text-gray-900 dark:text-gray-100` and `bg-white dark:bg-gray-800`).
- Add visual regression or Playwright check for dark mode to catch regressions.

Suggested labels: UI, frontend, dark-mode, P2

---
5) Medium: Put ingest page behind admin access
————————————————————————————————————
Priority: P2
Description:
- The ingest page should be restricted to admin users only rather than public.

Reproduction:
- Navigate to the ingest page and confirm it's accessible unauthenticated.

Suggested next steps:
- Add route guard on frontend and backend authorization enforcement for the ingest endpoints.
- If an auth system exists (JWT/session/role), ensure the route checks for `role: admin`.

Suggested labels: enhancement, security, P2

---
6) Low / Feature request: Re-add Elasticsearch
————————————————————————————————————
Priority: P3 (feature request)
Description:
- User requests Elasticsearch be re-added as a supported backend for search/indexing.

Notes & suggested approach:
- Evaluate cost vs. benefit: Meilisearch is lightweight; Elasticsearch provides advanced features but is heavier to operate.
- Add it behind a feature flag and provide migration scripts or adapters to keep indexing contracts consistent.

Suggested labels: enhancement, feature-request, search, P3

---

Next steps & how I can help
--------------------------
- I can create GitHub issues directly if you grant permission or want me to attempt using the repository management tools. Alternatively I can open a PR with fixes for small, low-risk issues (e.g., null-checking `toLocaleString` in `MeilisearchAdminPage.tsx`).
- I can also attempt to run the backend locally to reproduce the 500 and the SQL error if you want me to debug further.

Requirement coverage
--------------------
- Add to the repo issues: Done (this file added)
- Rank them on importance: Done (priorities P0–P3 assigned)
