# Code structure

## File size

**No source file over 300 lines** (TypeScript, TSX and CSS). A longer file is split by responsibility: data fetching into hooks or services, pure calculations into their own files, repeated markup into shared components, and CSS by section. JSON translation files follow the same idea by module (see [translations.md](translations.md)).

The rule is applied module by module. **Done: dashboard (Nov 2026), reports (Nov 2026).** Other modules still have larger files; split one when you next work on it. `scripts/check-file-size.sh` (a ratchet against `scripts/file-size-baseline.txt`) stops any file from growing or a new one from passing 300 lines; see [testing.md](testing.md).

## The routine for one module

Every module goes through the same six steps, with the suite from [testing.md](testing.md) as the safety net (`pnpm test` in `server/`):

1. **Inbox**: no `next` client item on the same files (`ops/inbox.md`).
2. **Pin**: add the module's API pins (every endpoint of its route files, every role that may call it, one that may not) and unit tests for its pure calculations, recorded on the unchanged code; commit the tests alone. Money modules (Timesheets, Invoices) also need a browser test that captures the totals the browser sends (first built with Timesheets).
3. **Dead code**: run `pnpm knip` in `client/` and `server/` and read the lines for the module; also `npx tsc --noEmit --noUnusedLocals` and `npx eslint` on its files (knip does not see variables that are assigned and never read); remove what is unused, suite green, own commit. Then **format** with Prettier, in its own commit, **only the files that stay under 300 lines afterwards** (Prettier makes a file 5 to 70% longer, and the size ratchet refuses a file that grows or a small file that passes 300). Files that are going to be split are not formatted first: the new files the split creates are formatted when they are created (the hook requires that), and the old file is replaced. Check the built JS and CSS are byte-identical before and after (`pnpm build` in `client/`).
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

## Reports module

| Where | What |
| --- | --- |
| `server/src/routes/reports.ts` | The router only: mounts the nine report routers in the original order (`/api/reports/...`, mounted by `index.ts` as before) |
| `server/src/routes/reports/<name>Report.ts` | One file per report (timesheet, margin, invoice, deduction, rateList, clients, sales, envelopePrintingPosition, envelopePrintingByDueDate): its `POST` route, access roles, queries and row building |
| `server/src/routes/reports/supabase.ts`, `clientActivity.ts` | The service-role client the reports share; the "client inactive after 30 days / jobseeker after 60" checks |
| `server/src/routes/reports/timesheetReportRows.ts` | Timesheet report: the row mapping (bulk timesheets resolve positions and rates) and the cash deduction amount |
| `server/src/routes/reports/envelope*.ts` | Envelope reports: serial number (`envelopeSrNo`), the invoice a timesheet line belongs to (`envelopeInvoiceLookup`), the rows per timesheet incl. hybrid pay splits (`envelopeItems`), and the biweekly consolidation (`envelopeConsolidation`) |
| `client/src/pages/Reports/<Report>.tsx` | One page per report: state, data fetching, CSV button |
| `client/src/pages/Reports/*Columns.ts`, `*Filters.tsx` | Column definitions and the filter bar of the pages that were large (weekly timesheet, sales, clients, envelope reports); envelope reports share `envelopeReportColumns.ts`, `EnvelopeReportTable.tsx` and `envelopeReportCsv.ts` |
| `client/src/pages/Reports/envelopeReportShared.ts`, `weeklyTimesheetCalc.ts` | The numbers the browser works out itself (currency and phone display, the CSV download's sort and serial renumbering, the weekly timesheet Sub Total); unit-tested in `server/tests/unit/reportCalculations.test.ts` |
| `client/src/services/api/reports.ts`, `reports/` | The API calls and row types, one file per report; `reports.ts` re-exports them so imports did not change |
| `client/src/styles/pages/Reports.css`, `CommonReportsStyles.css` | The module's CSS (both under 300 lines, not split) |
