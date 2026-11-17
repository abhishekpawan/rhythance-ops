# Translations (English / French)

Every piece of text a user can see goes through the translation system. This page has the coding rules and explains how the files are organised.

## How it works

- Hook: `const { t } = useLanguage();` from `client/src/contexts/language/language-provider.tsx`. Use `t("section.key")` or `t("section.key", { name })` for `{{name}}` placeholders.
- Two languages: `en` and `fr`. The choice is stored and persists across reloads (toggle: `LanguageToggle`).
- Every key must exist in **both** languages with the same placeholders and nesting. If unsure about the French, use `"[FR_TODO] English text"` and mention it in the commit.

## Coding rules

- **Translate** everything a user sees: headings, buttons, placeholders, `alt` and `title` text, toasts, `alert` and confirm messages, table headers. **Do not translate** technical strings: API paths, database fields, status and role values, console messages, file types, date formats.
- Never hard-code UI text in JSX (`<button>Send</button>`); use `t("buttons.send")`. Keys are descriptive and nested: `navigation.*`, `buttons.*`, `forms.*`, `messages.*`, `auth.*`, then one section per feature (`userManagement.title`), never `text1` or `msg`.
- Interpolation: `t("userManagement.pagination.showing", { start: 1, end: 10, total: 100 })` with `{{start}}` placeholders; the same placeholders in both languages.
- Add every new key to **both** languages in the same change; same structure and nesting.
- A component imports `useLanguage`, takes `t`, and renders no literal UI strings.

## Where the texts live

All files are in `client/src/contexts/language/locales/`.

| File | Contents |
| --- | --- |
| `en.json`, `fr.json` | Core texts: navigation, authentication, dashboard subtitles, clients, positions, consent, legal pages, training, and so on |
| `en/dashboard.json`, `fr/dashboard.json` | Admin and recruiter dashboards and the shared metric cards (`dashboard.*`) |
| `en/timesheet.json`, `fr/timesheet.json` | All timesheet screens (single entry, both bulk flows, all-timesheets list) |
| `en/reports.json`, `fr/reports.json` | Reports |
| `en/profile.json`, `fr/profile.json` | Jobseeker profile forms |
| `en/profileRules.json`, `fr/profileRules.json` | Wording of the profile rules that change with the `jobseeker_profile_godspeed_rules` flag |
| `en/jobseekerDashboard.json`, `fr/jobseekerDashboard.json` | Jobseeker dashboard (including the payroll cards) |
| `en/support.json`, `fr/support.json` | Support ticket module |
| `en/featureFlags.json`, `fr/featureFlags.json` | Feature Flags page |
| `en/portalSettings.json`, `fr/portalSettings.json` | Portal Settings page |

`language-provider.tsx` imports every file and combines the module files into the core file with `mergeLocale` (a deep merge, `mergeLocales.ts`).
**A new module file must be imported there for both languages**, otherwise its keys show up as "Translation missing".

Moving a section out of the core files into its own module file is the plan for every module (the dashboard was the first, Nov 2026). Move the whole top-level section as text in both languages, register the file, and check that the merged result is unchanged: the deep merge means nothing else needs to change.

## Brand name inside texts

Texts never contain a portal's name. Use the `{{brandName}}` placeholder; it is replaced with the portal's `branding.brandName`
setting (see [portals-and-configuration.md](../portals-and-configuration.md)). Examples: `navigation.aiChat` ("{{brandName}} AI Chat"), the signup brand description, dashboard subtitles, logo alt texts.

## Checking your work

- Open the page in both languages; look for raw keys on screen.
- The browser console prints `Translation missing for key ...` for any key that is absent in the active language. A page should produce none.
- Key sets of `en` and `fr` should be identical (same keys, same placeholders).
