# Activity logging

Every significant user operation on the server is written to the `recent_activities` table, which feeds the dashboard's Recent Activities card.
Checked against the code: November 2026.

## Adding it to a route

Put `activityLogger` (`server/src/middleware/activityLogger.ts`) after the auth middleware and before the handler. Have the handler leave the affected record in `res.locals` so the logger can name it. See `server/src/routes/timesheet.routes.ts` for working examples.

```typescript
router.post(
  "/route",
  authenticateToken,
  activityLogger({
    onSuccess: (req, res) => ({
      actionType: "action_name", // must be in the ActivityData union
      actionVerb: "created", // created / updated / deleted / sent email ...
      primaryEntityType: "entity_type",
      primaryEntityId: res.locals.entity?.id,
      primaryEntityName: res.locals.entity?.name || req.body.name,
      displayMessage: `Created ${res.locals.entity?.name}`,
      category: "client_management",
      priority: "normal",
    }),
  }),
  async (req, res) => {
    res.locals.entity = createdEntity;
    res.json({ success: true });
  }
);
```

- Categories: `user_management`, `candidate_management`, `position_management`, `client_management`, `financial`, `consent_management`, `system`.
- Up to three entities per record (primary, secondary, tertiary), for sentences like "assigned John to Driver at Acme". Primary is the subject, secondary the related thing (position, manager, client), tertiary extra context.
- Registration has no logged-in user, so the `/register` route sets a system user (id `00000000-0000-0000-0000-000000000000`) on `req` inside its `onSuccess`; see `server/src/routes/auth.ts`. Without a user the logger skips the record (and only prints a warning).
- Don't hard-code a sentence in the route beyond `displayMessage`; the dashboard builds the readable text from the fields (below).
- `logActivityDirect` exists in the middleware but no route uses it; use `activityLogger`.
- Feature flag and portal settings changes are deliberately **not** logged (their action types exist but are unused).

## Adding a new activity type

1. **Server:** add the name to the `actionType` union of `ActivityData` in `server/src/middleware/activityLogger.ts` (and a new category to its `category` union, if needed).
2. **Client types:** add it to the `action_type` union in **both** `client/src/hooks/recentActivityTypes.ts` and `client/src/components/dashboard/recentActivities/types.ts` (they are duplicates).
3. **Sentence:** add a `case` in the matching group file under `client/src/components/dashboard/recentActivities/`: `messagesPeople.tsx` (jobseekers, clients, positions, drafts, registration), `messagesFinance.tsx` (invoices, timesheets, bulk timesheets) or `messagesAdmin.tsx` (users and roles, invitations, consent, sent emails, flags, settings). Each returns `UNHANDLED` for types it does not own; `formatActivityMessage.tsx` tries the three in turn. Use `ActorName`, `PrimaryEntity` and friends from `EntityNames.tsx`. The sentences in these files are English only today (they do not use `t()`), a known gap.
4. **Icon:** icons are chosen by **category** in `activityIcons.tsx`; add a case only for a new category.
5. Check the card on the dashboard shows the new line.
