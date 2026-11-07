# Code structure

## File size

**No source file over 300 lines** (TypeScript, TSX and CSS). A longer file is split by responsibility: data fetching into hooks or services, pure calculations into their own files, repeated markup into shared components, and CSS by section. JSON translation files follow the same idea by module (see [translations.md](translations.md)).

The rule is applied module by module. **Done: dashboard (Nov 2026).** Other modules still have larger files; split one when you next work on it.

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
