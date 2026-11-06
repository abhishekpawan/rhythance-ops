# Documentation

Start here. The root [README](../README.md) covers installing and running the app; these pages explain what it does and how it is put together.
Last reorganised: November 2026. Every page is checked against the code unless it says otherwise.

## Pending work

| Page | What it is |
| --- | --- |
| [TODO.md](TODO.md) | Everything not done yet: owner decisions, planned work, open checks, known issues, clean-up |

## Understand the product

| Page | What it is |
| --- | --- |
| [product-brief.md](product-brief.md) | Plain-language overview: who uses the portal, every feature, user journeys, known gaps |
| [role-access-control.md](role-access-control.md) | Who can open which page and do which action; where the server differs from the UI |
| [codebase-audit.md](codebase-audit.md) | Status of every area (fully working, partial, stubbed) and a list of flagged problems |

## How it is built

| Page | What it is |
| --- | --- |
| [portals-and-configuration.md](portals-and-configuration.md) | The portals and branches, feature flags, portal settings, environment variables, seed files, setting up a new portal |
| [email-triggers.md](email-triggers.md) | Every email the portal sends, what triggers it and who gets it |
| [features/support-tickets.md](features/support-tickets.md) | Support ticket module |
| [features/digital-consent.md](features/digital-consent.md) | Digital consent module |
| [features/calendar.md](features/calendar.md) | Calendar module |
| [development/translations.md](development/translations.md) | English/French translation files and rules |
| [../server/src/db/migration_v2/README.md](../server/src/db/migration_v2/README.md) | Database migrations, in run order |
| [../server/src/db/seeds/README.md](../server/src/db/seeds/README.md) | Per-portal seed data |

## Working procedures

| Page | What it is |
| --- | --- |
| [automated-tasks/sync-commit-to-production-branches.md](automated-tasks/sync-commit-to-production-branches.md) | Prompt for copying a commit from `multiple-login-demo` to the four production branches and `public-main` |

## Reference material

| Page | What it is |
| --- | --- |
| [reference/terms-of-service-content.md](reference/terms-of-service-content.md) | Original Terms of Service wording |
| [reference/privacy-policy-content.md](reference/privacy-policy-content.md) | Original Privacy Policy wording |
| [reference/training-video-details.md](reference/training-video-details.md) | Titles and descriptions of the two mandatory training videos |
| [marketing/module-reports/](marketing/module-reports/) | Seven module-by-module summaries written for marketing and sales, listing what can and cannot be claimed. Derived from the code in May 2026; the claims the code has since overtaken (timesheet delete, view/edit, portal switcher, training videos, AI chat title, jobseeker dashboard) were corrected in November 2026, but these reports were not re-audited line by line. |

## Keeping the docs true

- Change a flag, setting, route, email or role: update the page that describes it in the same commit.
- Finish an item in [TODO.md](TODO.md): delete it there, and document the result in the relevant page above.
- Changing a value on the Portal Settings or Feature Flags pages: update that portal's file in `server/src/db/seeds/`.
- Docs live in git on every branch. Edit them on `multiple-login-demo` and sync them like code (see the sync procedure).
