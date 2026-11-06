# Calendar

A read-only calendar for staff that shows when jobseekers start and end their assignments on client positions. It creates and changes no data and needs no migration of its own.

Route: `/calendar`. Menu: Calendar. Roles: all internal staff (`CALENDAR_ROLES` in `client/src/constants/accessControl.ts`; see [role-access-control.md](../role-access-control.md)).

## What the user sees

- A month, week, day and agenda view (`react-big-calendar`), with a month shown first.
- Two kinds of all-day events: one per jobseeker assignment ("Jobseeker - Position", from the assignment's start to end date), and one per position that still has free slots ("Position (3 available)", from the position's start to end date). The open-slot events are hidden when the API is filtered by jobseeker.
- A side panel with the details for the selected day (`DayViewPanel`).
- Summary widgets above the calendar (`SummaryWidgets`): total, filled and available positions, open positions, completion rate and fill rate, with quick ranges for today, this week, this month and a custom range.
- All texts are translated (keys under `calendar.*`).

**Invoice-only subcategory positions are left out**, because they have no placements (`is_subcategory = false` filter).

## Code

| Part | Location |
| --- | --- |
| Page | `client/src/pages/Calendar/CalendarPage.tsx` |
| Components | `client/src/components/calendar/` (`CalendarView`, `DayViewPanel`, `SummaryWidgets`, `CalendarFilters`) |
| API client | `client/src/services/api/calendar.ts` |
| API | `server/src/routes/calendar.ts`, mounted at `/api/calendar` |

There is no separate controller: the queries are in the route file. They read `positions`, `position_candidate_assignments` and `jobseeker_profiles` and join them in application code.

## API

Both endpoints need a login and the `admin` or `recruiter` role (the `recruiter` check also lets the other internal roles through; see [codebase-audit.md](../codebase-audit.md)).

| Endpoint | Query parameters | Returns |
| --- | --- | --- |
| `GET /api/calendar` | `startDate`, `endDate` (both required, `YYYY-MM-DD`); optional `clientId`, `jobseekerId` | `events[]` (id, title, start, end, jobseeker, position, client, total/assigned/available positions) and a `summary` (total positions, total jobseekers, active assignments) |
| `GET /api/calendar/summary` | same | summary counts only |

A missing or badly formatted date returns 400.

## Known gaps

- The client and jobseeker **filter panel is built but switched off** (`CalendarFilters` is commented out in `CalendarPage.tsx`); the API already supports `clientId` and `jobseekerId`. Tracked in [../TODO.md](../TODO.md).
- The summary widgets are used without client/jobseeker props.
