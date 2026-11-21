# Code structure

## File size

**No source file over 300 lines** (TypeScript, TSX and CSS). A longer file is split by responsibility: data fetching into hooks or services, pure calculations into their own files, repeated markup into shared components, and CSS by section. JSON translation files follow the same idea by module (see [translations.md](translations.md)).

The rule is applied module by module. **Done: dashboard (Nov 2026), reports (Nov 2026), support tickets (Nov 2026), admin pages / calendar / email previews / training (Nov 2026).** Other modules still have larger files; split one when you next work on it. `scripts/check-file-size.sh` (a ratchet against `scripts/file-size-baseline.txt`) stops any file from growing or a new one from passing 300 lines; see [testing.md](testing.md).

## The routine for one module

Every module goes through the same six steps, with the suite from [testing.md](testing.md) as the safety net (`pnpm test` in `server/`):

1. **Inbox**: no `next` client item on the same files (`ops/inbox.md`).
2. **Pin**: add the module's API pins (every endpoint of its route files, every role that may call it, one that may not) and unit tests for its pure calculations, recorded on the unchanged code; commit the tests alone. Money modules (Timesheets, Invoices) also need a browser journey that captures the totals the browser sends (the request-body pattern is in `e2e/tests/reports.spec.ts`, see [testing.md](testing.md) "Browser journeys").
3. **Dead code**: run `pnpm knip` in `client/` and `server/` and read the lines for the module; also `npx tsc --noEmit --noUnusedLocals` and `npx eslint` on its files (knip does not see variables that are assigned and never read); remove what is unused, suite green, own commit. Then **format** with Prettier, in its own commit, **only the files that stay under 300 lines afterwards** (Prettier makes a file 5 to 70% longer, and the size ratchet refuses a file that grows or a small file that passes 300). Files that are going to be split are not formatted first: the new files the split creates are formatted when they are created (the hook requires that), and the old file is replaced. Check the built JS and CSS are byte-identical before and after (`pnpm build` in `client/`).
4. **Split**: move code verbatim, file by file; after each file the type checks, lint and the suite. Snapshots must not change: **a changed snapshot is a behaviour change and stops the split.** CSS: the built CSS must be identical. Update `scripts/file-size-baseline.txt` with `scripts/check-file-size.sh --update` in the same commit.
5. **Browser check** of the module's screens per role, in English and French: `pnpm test:e2e` in `e2e/` where journeys exist (sign-in for every role and Reports today; a module's journeys are added in step 2), by hand only for screens without one, and say which.
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

## Support module

| Where | What |
| --- | --- |
| `server/src/routes/support/index.ts` | Mounts the three routers in the original order (attachments, tickets, ticket actions); `/api/support/...` |
| `server/src/routes/support/tickets.ts`, `ticketActions.ts` | Routers only: `tickets.ts` mounts `ticketCreate`, `ticketList`, `ticketGet`; `ticketActions.ts` mounts `ticketMessages`, `ticketConfirm`, `ticketReopen`, `ticketPatch` |
| `server/src/routes/support/ticket<Name>.ts` | One file per endpoint: its route, access rule (404 for anyone who may not), validation, the call to the database function, and the message it sends |
| `server/src/routes/support/attachments.ts` | The signed upload link and the signed download link |
| `server/src/services/support.permissions.ts`, `support.patchFields.ts`, `support.serializers.ts` | The tables behind PATCH: who may change which field; what each field accepts and in which order it is checked (`ticketPatch.ts` only reads them); the columns each viewer's serializer writes (the list selects exactly those) |
| `client/src/pages/Support/SupportList.tsx`, `SupportListTable.tsx` | The ticket list: state and fetching, the empty state and the page buttons (shared `EmptyState` and `Pagination`); the table |
| `client/src/pages/Support/SupportNew.tsx`, `SupportNewTypeSection.tsx`, `SupportNewUrgencySection.tsx`, `supportNewForm.ts` | Raise a ticket: the form and its submit; the three type cards; the three urgency options; the form's schema and type |
| `client/src/pages/Support/SupportTicket.tsx`, `SupportTicketHeaderCard.tsx`, `useSupportTicket.ts`, `useSupportTicketActions.ts`, `supportTicketHelpers.ts` | One ticket: the page; the header card; the data hook (ticket, messages, files, the agent panel's starting values, download); the actions hook (reply, confirm, reopen, agent save); the next-status table and the number and date formats |
| `client/src/pages/Support/SupportThread.tsx`, `SupportThreadPreviewModal.tsx` | The messages with their files; the image preview (on the shared `Modal`) |
| `client/src/pages/Support/SupportAttachmentUploader.tsx`, `SupportDropzone.tsx`, `SupportUploadItemRow.tsx`, `SupportUploadPreviewModal.tsx` (on the shared `Modal`), `supportUploadItem.ts`, `supportFormat.ts` | The upload widget: logic and paste; the drop area; one file row; the preview; the limits and the item type; the file size text |
| `client/src/pages/Support/SupportReplyBox.tsx`, `SupportResolutionPanel.tsx`, `SupportAgentPanel.tsx`, `SupportStatusBadge.tsx`, `SupportTypeBadge.tsx` | Unchanged (under 300 lines) |
| `client/src/styles/pages/Support.css`, `Support.<area>.css` | `Support.css` only imports the nine parts (base, toolbar, badges, new, files, modal, ticket, agent, responsive) in the original order; the built CSS file is byte-identical to before the split |

Safety net for this module: `server/tests/pins/support-*.test.ts` (all nine endpoints, every role) and `e2e/tests/support.spec.ts` (`docs/development/testing.md`).

## Admin pages, calendar, email previews and training module

| Where | What |
| --- | --- |
| `client/src/pages/Admin/FeatureFlagsPage.tsx`, `FeatureFlagCard.tsx`, `useFeatureFlagsAdmin.ts` | Feature flags (super admin): the page (summary, search, groups, the confirm window); one flag's card (switch, text settings, per-portal intent, reset); the data hook (load, switch, save texts, reset, toast, drafts) |
| `client/src/pages/Admin/DropdownOptionsManagement.tsx`, `DropdownListTabs.tsx`, `DropdownOptionsList.tsx` | Dropdown options: the page (add form and the calls); the two rows of list buttons; the options with their edit and delete buttons |
| `client/src/pages/Admin/PortalSettingsPage.tsx` | Unchanged (under 300 lines); uses the `ff-` styles of the feature flags page |
| `client/src/pages/EmailTemplatePreview/EmailTemplatePreviewPage.tsx`, `EmailTemplateSidebar.tsx`, `EmailTemplateMeta.tsx` | Email previews (super admin): the page (loading, the HTML and text views, sample data); the template list on the left; name, service, subject, sender, copies, attachments and trigger |
| `client/src/pages/TrainingModules/index.tsx`, `trainingModules.tsx` | Training: the page (filters, search, the two windows); the list of modules (`buildTrainingModules(portalSettings)`: the first two videos are the portal's own settings) |
| `client/src/components/calendar/SummaryWidgets.tsx`, `SummaryWidgetsSkeleton.tsx`, `useCalendarSummary.ts` | The calendar's summary: the numbers and period buttons; the loading look; what is asked of the server and the figures worked out from the answer |
| `client/src/components/calendar/DayViewPanel.tsx`, `DayViewSkeleton.tsx` | The day panel and its loading look |
| `client/src/styles/pages/FeatureFlags.css`, `EmailTemplatePreview.css`, `TrainingModules.css`; `components/calendar/CalendarView.css`, `SummaryWidgets.css`, `DayViewPanel.css` | Each file only imports its parts (`<Name>.<area>.css`, 2 to 4 each) in the original order; the built CSS file is byte-identical to before the split |
| `server/src/routes/calendar.ts`, `routes/calendar/events.ts`, `summary.ts`, `supabase.ts` | The router mounts the two endpoints in the original order (`/api/calendar`, `/api/calendar/summary`); the service-role client they share |
| `server/src/routes/emailTemplates.ts`, `routes/emailTemplates/registry.ts` | The two routes (list, preview) and the sender and copy helpers; the ten templates with their sample data and render functions |
| `server/src/services/featureFlags.ts`, `featureFlags.types.ts` | The cache, the reads and the writes (export names unchanged); the types and `FeatureFlagError` (re-exported by `featureFlags.ts`) |

Removed in the same module (dead code): `CalendarFilters.tsx` and its CSS (built, never mounted), `renderedcalenderhtml.html` (a 1,210-line reference nothing imported) and five unused helpers of `services/api/calendar.ts`.

Safety net for this module: `server/tests/pins/admin-flags.test.ts`, `admin-dropdowns.test.ts`, `calendar.test.ts`, `email-templates.test.ts` (all 18 endpoints) and `e2e/tests/admin-pages.spec.ts`, `calendar-training-email.spec.ts` (`docs/development/testing.md`).

## Shared UI pieces (`client/src/components/`)

Built in the Support "b" step (R-2b) from the markup the pages wrote by hand, and **adopted module by module**: only Support uses them so far. Each writes the same markup, classes and styles its first users had, so adopting one in a page changes nothing a person sees. All words come in as props, already translated; the pieces add no text.

| Piece | What it is | Props |
| --- | --- | --- |
| `Pagination.tsx` and `hooks/usePagination.ts` | The `pagination-controls` bars of the list pages (CommonTable.css). `position="top"` is the info line and the page-size picker, `position="bottom"` the Previous, five page numbers, Next bar (nothing when there is one page). `usePagination` holds the window maths (`pageWindow`). | `position`, `pagination` (the endpoint's `page, limit, total, totalPages, hasNextPage, hasPrevPage`), `labels` (`info`, `filteredInfo`, `show`, `perPage`, `pageInfo`, `previous`, `next`, `previousTitle`, `nextTitle`, `goToPage`), `onPageChange`, `onLimitChange`, `pageSizes` (default 10, 25, 50, 100), `selectId`, `className` |
| `EmptyState.tsx` | The centred "nothing here yet" block of a card: icon, title, text, action. Its inline styles are the Support list's. There is no table-row variant yet. | `icon`, `title`, `description`, `action` |
| `StatusBadge.tsx` | A pill with a text: writes `<baseClass> <tone> <className>` and keeps the colours in the page's own stylesheet. `variant="dot"` (a dot and a label, `role="status"`) or `"tag"` (an optional icon). | `baseClass`, `tone`, `label`, `className`, `variant`, `icon` |
| `Modal.tsx` | A window over the page: backdrop, header with title, optional header buttons, close button, body; closes on the backdrop, the close button and Escape, and puts the focus back on what had it. Classes are `<classPrefix>-backdrop`, `-content`, `-header`, `-title`, `-body`, `-close`, so the page styles it (and keeps its own z-index). `ConfirmationModal` is not built on it yet. | `classPrefix`, `ariaLabel`, `closeLabel`, `title`, `actions`, `onClose`, `children` |

Proof for each (R-2b): the Support screens captured before and after (markup, and screenshots in both languages at 1440 and 1024 px) are identical; `e2e/tests/pagination-component.spec.ts` renders `Pagination` and compares it, tag for tag, with All users' own bars (the page is not changed); `e2e/tests/support-preview.spec.ts` covers `Modal`'s Escape and focus. The loader was **not** moved onto `components/Loader.tsx`: Support's spinner is 20 px, black and 1 s, the shared one 36 px, themed and 0.9 s, inside a block with its own height, so it would look different (a layout decision, D17). One `@keyframes spin` now lives in `styles/utils.css`; copies with another body stay.
