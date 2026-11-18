# Code structure

## File size

**No source file over 300 lines** (TypeScript, TSX and CSS). A longer file is split by responsibility: data fetching into hooks or services, pure calculations into their own files, repeated markup into shared components, and CSS by section. JSON translation files follow the same idea by module (see [translations.md](translations.md)).

The rule is applied module by module. **Done: dashboard (Nov 2026).** Other modules still have larger files; split one when you next work on it. `scripts/check-file-size.sh` (a ratchet against `scripts/file-size-baseline.txt`) stops any file from growing or a new one from passing 300 lines; see [testing.md](testing.md).

## The routine for one module

Every module goes through the same six steps, with the suite from [testing.md](testing.md) as the safety net (`pnpm test` in `server/`):

1. **Inbox**: no `next` client item on the same files (`ops/inbox.md`).
2. **Pin**: add the module's API pins (every endpoint of its route files, every role that may call it, one that may not) and unit tests for its pure calculations, recorded on the unchanged code; commit the tests alone. Money modules (Timesheets, Invoices) also need a browser test that captures the totals the browser sends (first built with Timesheets).
3. **Dead code**: run `pnpm knip` in `client/` and `server/` and read the lines for the module; remove what is unused, suite green, own commit. Then **format** the module's files with Prettier in their own commit (whitespace only; the suite and both builds stay green), so that code moved verbatim lands in files the pre-commit hook accepts.
4. **Split**: move code verbatim, file by file; after each file the type checks, lint and the suite. Snapshots must not change: **a changed snapshot is a behaviour change and stops the split.** CSS: the built CSS must be identical. Update `scripts/file-size-baseline.txt` with `scripts/check-file-size.sh --update` in the same commit.
5. **Browser check** of the module's screens per role, in English and French (browser journeys where they exist, by hand where not).
6. **Sync** with `branch-sync` (tests included), drift check 0, then the tracker and one log line.

When splitting:

- Move code verbatim first and change behaviour separately, so a split can be checked by comparing outputs.
- Split CSS only between top-level rules, and import the parts in their original order right after the original import. The bundled CSS must then be the same as before.
- Keep the original file name for the main part, so existing imports keep working.

## Dashboard module

| Where | What |
| --- | --- |
| `client/src/pages/Dashboard/AdminDashboard.tsx`, `RecruiterDashboard.tsx`, `JobSeekerDashboard.tsx` | The three dashboards (layout only) |
| `client/src/pages/Dashboard/shared/` | What the dashboards share: card config and API mapping, data hooks (cache, fetch, "Show all"), the toggle, metric grid, AI summary and client card, the timesheet and invoice card hooks |
| `client/src/components/dashboard/MetricCard*.tsx`, `useMetricCardChart.ts`, `MetricChart*.tsx`, `utils.ts` | The metric card: value, 30-day trend, the chart (30 days daily with the previous 30 days dashed, or 12 months) |
| `client/src/components/dashboard/RecentActivities.tsx` and `recentActivities/` | The activity feed; one file per group of activity sentences |
| `server/src/utils/metricMonths.ts` | The only place card numbers are calculated: running total, last 30 days vs the 30 days before (whole Toronto days), monthly chart, paged reads |
| `server/src/services/recruiterMetrics.ts`, `expiryStatusCounts.ts`, `jobseekerPayroll.ts` | Card builders behind the metric routes |
