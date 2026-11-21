// How many bytes of JavaScript and CSS the built client downloads for the sign-in page and for the dashboard
// (empty browser cache each time). A measurement for the speed work (SPEED-1), not a pass/fail check of sizes:
// it only runs on the production build (`E2E_CLIENT=build pnpm test:e2e`), because the dev server serves
// thousands of unbundled modules, and it fails only when nothing was counted (a sign the build was not served).
// The background download of the other pages (client/src/routes/prefetchPages.ts, measured in prefetch.spec.ts) is
// switched off here by telling the page the browser wants to save data: this measures what is needed to show the page.
// "gzip" is what the file would cost over the wire with gzip (the preview server itself sends it uncompressed).
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { expect, test } from "../support/fixtures";

test.skip(
  process.env.E2E_CLIENT !== "build",
  "measured on the production build only (E2E_CLIENT=build)"
);

type Counted = { file: string; raw: number; gzip: number };

async function count(
  page: import("@playwright/test").Page,
  open: () => Promise<void>
) {
  const seen: Promise<Counted | null>[] = [];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
    });
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (!/\.(js|css)$/.test(url.pathname) || !/^\/assets\//.test(url.pathname))
      return;
    seen.push(
      response.body().then(
        (body) => ({
          file: url.pathname.replace(/^\/assets\//, ""),
          raw: body.length,
          gzip: gzipSync(body).length,
        }),
        () => null
      )
    );
  });
  await open();
  await page.waitForLoadState("networkidle");
  const files = (await Promise.all(seen)).filter((f): f is Counted => !!f);
  const sum = (ext: string, key: "raw" | "gzip") =>
    files
      .filter((f) => f.file.endsWith(ext))
      .reduce((total, f) => total + f[key], 0);
  return {
    files,
    jsRaw: sum(".js", "raw"),
    jsGzip: sum(".js", "gzip"),
    cssRaw: sum(".css", "raw"),
    cssGzip: sum(".css", "gzip"),
  };
}

function report(name: string, result: Awaited<ReturnType<typeof count>>) {
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    `test-results/bundle-bytes-${name}.json`,
    JSON.stringify(result, null, 2)
  );
  const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
  console.log(
    `BUNDLE ${name}: ${result.files.length} files, JS ${kb(result.jsRaw)} raw / ${kb(
      result.jsGzip
    )} gzip, CSS ${kb(result.cssRaw)} raw / ${kb(result.cssGzip)} gzip`
  );
  expect(result.files.length).toBeGreaterThan(0);
}

test("the sign-in page: JavaScript and CSS downloaded", async ({ page }) => {
  const result = await count(page, async () => {
    await page.goto("/login");
    await page.locator("#email").waitFor();
  });
  report("login", result);
});

test.describe("the dashboard", () => {
  test.use({ storageState: ".auth/admin.json" });
  test("JavaScript and CSS downloaded", async ({ page }) => {
    const result = await count(page, async () => {
      await page.goto("/dashboard");
      await page.locator(".dashboard-heading").waitFor();
    });
    report("dashboard", result);
  });
});
