# Godspeed Operations Portal

A staffing-agency operations platform: clients, positions, jobseekers, timesheets, invoices, reports, digital consent, a calendar, support tickets and an AI assistant, with role-based access. One codebase runs several separately branded portals (AllStaff, CanHire, Godspeed, GD Workforce), each with its own Supabase database.

- **Client:** React 18, TypeScript, Vite, React Router, React Hook Form with Zod, Axios, Supabase JS, `@react-pdf/renderer` (invoice PDFs), `react-big-calendar`.
- **Server:** Node.js, Express, TypeScript, Supabase (database, auth, storage, realtime), SendGrid (email), Twilio Verify (SMS codes), Helmet.
- **AI service:** a separate repository, `godspeed-ops-ai` (FastAPI); the portal embeds its chat and sends it documents to verify.

## Where to read next

Everything about what the portal does and how it is put together is in **[docs/](docs/README.md)**:
the [product brief](docs/product-brief.md), [roles and access](docs/role-access-control.md), [portals and per-portal configuration](docs/portals-and-configuration.md), [emails](docs/email-triggers.md), and the [to-do list](docs/TODO.md).

## Project structure

```
godspeed-ops-portal/
├── client/                 # React app
│   └── src/
│       ├── components/     # Shared UI (header, menu, route guards, calendar, dashboard widgets)
│       ├── constants/      # accessControl.ts: which roles see which page
│       ├── contexts/       # Auth, feature flags, portal settings, language (+ locales/)
│       ├── pages/          # One folder per area (Dashboard, TimesheetManagement, Support, Admin, ...)
│       ├── services/api/   # One API client file per backend area
│       └── lib/, utils/, hooks/, styles/, types/, assets/
├── server/
│   └── src/
│       ├── routes/         # Express routes, mounted under /api (see index.ts)
│       ├── controllers/, services/   # Timesheets, support, feature flags, portal settings, ...
│       ├── middleware/     # Auth and roles, security, emailNotifier, super admin
│       ├── config/         # featureFlags.ts and portalSettings.ts registries
│       ├── email-templates/
│       ├── db/             # migration_v2/ (run in order), seeds/ (one per portal), functions/
│       └── scripts/        # create-admin.ts
├── docs/                   # Documentation (start at docs/README.md)
├── scripts/                # automated_timezone_test.mjs
└── .prettierrc.json        # Formatting rules; format on save
```

## Getting started

### Prerequisites

- Node.js 24.21.0 (`.nvmrc`; the packages accept `>=24 <25`) and pnpm 10.28.2 (`>=10.28.2 <11`)
- A Supabase project for the database

### Install

```bash
git clone git@github.com:Motion-Falcon/godspeed-ops-portal.git
cd godspeed-ops-portal

cd client && cp .env.example .env && pnpm install     # then fill in client/.env
cd ../server && cp .env.example .env && pnpm install  # then fill in server/.env
```

### Prepare the database

Run `server/src/db/migration_v2/*.sql` in order on the Supabase project, then the matching file from `server/src/db/seeds/` (settings and flags for that portal). Create the first admin with `server/src/scripts/create-admin.ts`. Details: [docs/portals-and-configuration.md](docs/portals-and-configuration.md#setting-up-a-new-portal).

### Run

```bash
cd server && pnpm dev    # API on http://localhost:5001 (set PORT to change)
cd client && pnpm dev    # app on http://localhost:5173, proxying /api to the API
```

### Other commands

| Where | Command | What it does |
| --- | --- | --- |
| `client` | `pnpm build` | Type check, then production bundle |
| `client`, `server` | `pnpm lint` | ESLint |
| `server` | `pnpm build` | Compile to `dist/` (also runs after `pnpm install`) |
| `server` | `pnpm start` | Run the compiled server |
| repo root | `node scripts/automated_timezone_test.mjs` | Date-handling checks across several time zones; it imports from `server/dist`, so build the server first |

## Environment variables

Full tables, including which are secrets and which are only fallbacks for Portal Settings, are in [docs/portals-and-configuration.md](docs/portals-and-configuration.md#environment-variables). The ones you need to run locally:

- **Client (`client/.env`):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (defaults to `http://localhost:5001`)
- **Server (`server/.env`):** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `CLIENT_URL`, `PORT` (default 5001); `SENDGRID_API_KEY`, the Twilio keys and `AI_VERIFICATION_URL` for email, SMS codes and document verification

## Branches

New work goes to `multiple-login-demo` and is copied to the four production branches (`allstaff-production`, `canhire-production`, `godspeed-production`, `hdgroup-production`) and `public-main` by cherry-pick. See [docs/automated-tasks/sync-commit-to-production-branches.md](docs/automated-tasks/sync-commit-to-production-branches.md).

## License

ISC
