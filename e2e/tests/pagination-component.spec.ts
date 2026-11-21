// `<Pagination>` (client/src/components/Pagination.tsx) must write exactly the markup that the list pages wrote by
// hand. The All users page still has its own copy (the shared bar is adopted module by module), so this test opens
// that page, makes the server answer with a pager of the shape asked for (the seed is too small to have one), and
// compares the page's two bars, tag for tag, with what the component renders for the same numbers and words.
//
// The component is rendered here, in Node, with the client's own copy of React; nothing of the page is changed.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pagination } from "../../client/src/components/Pagination";
import { expect, test, type Language } from "../support/fixtures";

const here = path.dirname(fileURLToPath(import.meta.url));
const fromClient = createRequire(
  path.resolve(here, "../../client/package.json")
);
const React = fromClient("react");
const { renderToStaticMarkup } = fromClient("react-dom/server");

type Words = Record<string, string>;
const locale = (language: Language) =>
  fromClient(`./src/contexts/language/locales/${language}.json`) as {
    userManagement: { pagination: Words };
    buttons: Words;
  };

/** The markup of an element as the browser reports it, with the tags on their own lines so a difference is readable. */
const lines = (html: string) => html.replace(/></g, ">\n<");

test.use({ storageState: ".auth/admin.json" });

for (const language of ["en", "fr"] as const) {
  test.describe(`the shared pagination bars equal All users' own, in ${language}`, () => {
    test.use({ language });

    // the page (current), how many pages there are, and whether the filter hides some entries
    const cases = [
      { page: 1, totalPages: 9, total: 120, totalFiltered: 87, limit: 10 },
      { page: 5, totalPages: 9, total: 90, totalFiltered: 90, limit: 25 },
      { page: 9, totalPages: 9, total: 90, totalFiltered: 83, limit: 10 },
      { page: 2, totalPages: 3, total: 21, totalFiltered: 21, limit: 10 },
    ];

    for (const c of cases) {
      test(`page ${c.page} of ${c.totalPages}, ${c.limit} a page`, async ({
        page,
      }) => {
        const pagination = {
          ...c,
          hasNextPage: c.page < c.totalPages,
          hasPrevPage: c.page > 1,
        };
        await page.route("**/api/users?*", async (route) => {
          const response = await route.fetch();
          const json = await response.json();
          json.pagination = pagination;
          await route.fulfill({ response, json });
        });
        await page.goto("/all-users-management");
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        await expect(page.locator(".pagination-controls.bottom")).toBeVisible();
        await page.waitForLoadState("networkidle");

        const top = lines(
          await page
            .locator(".pagination-controls.top")
            .evaluate((n) => n.outerHTML)
        );
        const bottom = lines(
          await page
            .locator(".pagination-controls.bottom")
            .evaluate((n) => n.outerHTML)
        );

        // the words, composed the way AllUsersManagement.tsx composes them
        const w = locale(language).userManagement.pagination;
        const b = locale(language).buttons;
        const first = Math.min((c.page - 1) * c.limit + 1, c.totalFiltered);
        const last = Math.min(c.page * c.limit, c.totalFiltered);
        const labels = {
          info: `${w.showing} ${first} ${w.to} ${last} ${w.of} ${c.totalFiltered} ${w.entries}`,
          filteredInfo:
            c.totalFiltered !== c.total
              ? `(${w.filteredFrom} ${c.total} ${w.totalEntries})`
              : undefined,
          show: w.show,
          perPage: w.perPage,
          pageInfo: `${w.page} ${c.page} ${w.of} ${c.totalPages}`,
          previous: b.previous,
          previousTitle: w.previousPage,
          next: b.next,
          nextTitle: w.nextPage,
          goToPage: w.goToPage,
        };
        // the server-side renderer writes `selected` on the chosen option, which the browser only keeps as a
        // property; the markup is read back through the browser so both sides are written the way it writes them
        const shared = async (position: "top" | "bottom") => {
          const html = renderToStaticMarkup(
            React.createElement(Pagination, {
              position,
              pagination,
              labels,
              pageSizes: [10, 25, 50, 100],
              onPageChange: () => undefined,
              onLimitChange: () => undefined,
            })
          ).replace(' selected=""', "");
          return lines(
            await page.evaluate((markup) => {
              const box = document.createElement("div");
              box.innerHTML = markup;
              return box.firstElementChild!.outerHTML;
            }, html)
          );
        };

        expect(await shared("top")).toBe(top);
        expect(await shared("bottom")).toBe(bottom);
      });
    }
  });
}
