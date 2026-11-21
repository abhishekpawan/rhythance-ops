// How many times the browser asks for the same data in one page load (SPEED-1, step 1). The numbers are
// pinned at what the app does; a change in them is a change in what the page asks for, so read it before
// updating. Counted from the GET requests the browser sends to the server, once the page has shown its
// content and gone quiet (the same on the dev server and on the production build).
import type { Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";

test.use({ storageState: ".auth/admin.json" });

const PUBLIC_SETTINGS = "/api/portal-settings/public";

/** The pages and what each endpoint is asked, per load. Today's numbers (AUDIT-1 §6 measured the same). */
const PAGES = [
  {
    name: "the dashboard",
    route: "/dashboard",
    ready: ".dashboard-heading",
    asked: {
      "/api/metrics/jobseekers/expiry-status-counts": 3,
      [PUBLIC_SETTINGS]: 2,
    },
  },
  {
    name: "Recruiter hierarchy",
    route: "/recruiter-hierarchy",
    ready: ".recruiter-hierarchy .dashboard-heading",
    asked: { "/api/users": 6, [PUBLIC_SETTINGS]: 2 },
  },
  {
    name: "All users",
    route: "/all-users-management",
    ready: "table",
    asked: { "/api/users": 5, [PUBLIC_SETTINGS]: 2 },
  },
];

/** Opens `route` and counts, per endpoint path, the GET requests to the server until the page is quiet. */
async function countsOnLoad(page: Page, route: string, ready: string) {
  const counts: Record<string, number> = {};
  page.on("request", (request) => {
    if (request.method() !== "GET") return;
    const { pathname } = new URL(request.url());
    if (pathname.startsWith("/api/"))
      counts[pathname] = (counts[pathname] ?? 0) + 1;
  });
  await page.goto(route);
  await page.locator(ready).first().waitFor();
  await page.waitForLoadState("networkidle");
  return counts;
}

for (const { name, route, ready, asked } of PAGES) {
  test(`${name}: how often each endpoint is asked in one load`, async ({
    page,
  }) => {
    const counts = await countsOnLoad(page, route, ready);
    const wanted = Object.keys(asked);
    expect(
      Object.fromEntries(wanted.map((path) => [path, counts[path] ?? 0]))
    ).toEqual(asked);
  });
}
