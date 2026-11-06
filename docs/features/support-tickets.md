# Support tickets

An in-portal help desk: staff report a bug, ask for a change or feature, or ask a question; a **super admin acts as the support agent**. The module is for internal staff only and is hidden from jobseekers everywhere (menu, route guard and API).

Routes: `/support` (list), `/support/new`, `/support/:id`. Access for the pages is `SUPPORT_ROLES` (all internal staff roles, see [role-access-control.md](../role-access-control.md)).

## People involved

| Who | How the code decides | What they can do |
| --- | --- | --- |
| **Requester** | Any logged-in user who is not a jobseeker | Create tickets, reply on their own tickets, confirm a resolution, reopen |
| **Shared viewer** | `admin`, `recruiter`, `recruiter_manager`, `recruiter_director` (`SUPPORT_SHARED_VIEW_ROLES`) | Also see everyone's tickets (`scope=all`) |
| **Agent** | `superadmin` in the user's roles | See all tickets, reply publicly or with internal notes, change status, priority, title, assignee and effort |

A user who is neither the owner nor an agent gets "not found" for a ticket (not "forbidden"), so ticket ids do not leak.

## Ticket fields

- **Type:** `bug`, `change`, `feature`, `question`.
- **Urgency** (chosen by the requester): `blocked`, `annoying`, `not_urgent`.
- **Priority** (set by the agent, default `p3`): `p1`, `p2`, `p3`.
- **Status:** `open`, `in_progress`, `waiting_on_client`, `resolved`, `closed`. Every change is recorded in `support_ticket_status_events`.
- Title up to 200 characters; messages up to 10,000 characters; the agent can record effort in hours (stored as minutes).
- Ticket reference shown to people: `SUP-0001`, `SUP-0002`, and so on.
- Diagnostic context is captured with the ticket: the page (route and the page the user came from), language, browser, operating system, build and deployment, the user's id and roles, plus the last 5 console errors and last 5 failed requests (errors trimmed to 300 characters) (`client/src/lib/supportContext.ts`, `server/src/services/support.context.ts`).

## Lifecycle

1. Requester creates a ticket (optionally with attachments) and the support team is emailed (#16).
2. Both sides exchange messages. Agents can mark a message **internal**, which is never shown to the requester and never emailed.
3. The agent sets `waiting_on_client` or `resolved`; the requester is emailed (#20).
4. A resolved ticket is closed when the requester confirms (`POST /tickets/:id/confirm`), or **automatically after 7 days** without a response (`support_auto_close_resolved`, run by a daily `pg_cron` job at 03:30 UTC; the record keeps who closed it: `client`, `agent` or `auto`).
5. A resolved or closed ticket can be reopened by its owner or an agent. An owner can reopen a ticket **for 14 days after it was closed**; after that they must open a new ticket.

## Attachments

Direct upload to the private `support-attachments` Supabase Storage bucket using signed URLs (`POST /attachments/sign`, `GET /attachments/:id/url`). Allowed: PNG, JPEG, WebP, GIF, PDF, plain text/log and CSV files, at most 10 MB each and 5 per submission. Type, extension, size and storage presence are re-checked on the server before anything is saved. Only the ticket owner or an agent can open an attachment.

## API (`/api/support`, `server/src/routes/support/`)

| Endpoint | Who |
| --- | --- |
| `POST /tickets`, `GET /tickets` (`scope=mine` default or `all`, `status`, `page`, `limit` up to 100), `GET /tickets/:id` | requester or agent |
| `POST /tickets/:id/messages` | owner or agent |
| `POST /tickets/:id/confirm` | owner, ticket must be `resolved` |
| `POST /tickets/:id/reopen` | owner or agent |
| `PATCH /tickets/:id` | agent only (status, priority, title, assignee, effort) |
| `POST /attachments/sign`, `GET /attachments/:id/url` | requester or agent (download: ticket owner or agent) |

Status changes and messages go through database functions (`support_change_status`, `support_add_message`, and so on in `027_support_module.sql`) so the status history and the reopen window are enforced in one place.

## Emails

Five emails, #16 to #20, described in [email-triggers.md](../email-triggers.md). Notifications to the support team go to the Portal Settings `email.supportNotifyTo` / `email.supportNotifyCc`; if "to" is empty, no notification is sent.

## Code

| Part | Location |
| --- | --- |
| Pages and components | `client/src/pages/Support/` |
| API client | `client/src/services/api/support.ts` |
| Routes | `server/src/routes/support/` (`tickets.ts`, `ticketActions.ts`, `attachments.ts`) |
| Services | `server/src/services/support.*.ts` (permissions, email, attachments, serializers, context, errors) |
| Schema | `server/src/db/migration_v2/027_support_module.sql` (tables `support_tickets`, `support_ticket_messages`, `support_ticket_attachments`, `support_ticket_status_events`; private storage bucket; RLS) |
| Texts | `client/src/contexts/language/locales/{en,fr}/support.json` |
