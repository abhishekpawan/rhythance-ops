// Every browser request to a host other than this machine is aborted and counted (nothing leaves the
// computer). A test fails when the page tries a host that is not in KNOWN_OUTSIDE_HOSTS, so a new font,
// CDN, analytics script or API call shows up at once. The known hosts are still aborted: the list says
// "we know the app asks for this", it never lets a request through.
import { appendFileSync } from "node:fs";
import path from "node:path";
import type { BrowserContext } from "@playwright/test";

export const OUTSIDE_LOG = path.resolve(
  "test-results",
  "outside-requests.jsonl"
);

/**
 * What the app tries to reach on purpose. Nothing: since SPEED-1 the Inter font is served by the app itself
 * (client/src/fonts/). The one entry is a made-up host that only the guard journey (tests/guard.spec.ts) asks for,
 * to prove that a known host is aborted and counted; no page of the app uses it.
 */
export const KNOWN_OUTSIDE_HOSTS: Record<string, string> = {
  "guard-probe.example.invalid":
    "asked only by tests/guard.spec.ts, on purpose",
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isLocalUrl(url: URL) {
  return LOCAL_HOSTS.has(url.hostname.toLowerCase());
}

/** Aborts every request that is not local; returns what was tried so far (host -> urls). */
export async function blockOutside(context: BrowserContext, testTitle: string) {
  const tried: { host: string; url: string }[] = [];
  await context.route(
    (url) => /^https?:$/.test(url.protocol) && !isLocalUrl(url),
    (route) => {
      const url = new URL(route.request().url());
      tried.push({ host: url.hostname, url: url.origin + url.pathname });
      appendFileSync(
        OUTSIDE_LOG,
        JSON.stringify({
          test: testTitle,
          host: url.hostname,
          url: url.origin + url.pathname,
        }) + "\n"
      );
      return route.abort("blockedbyclient");
    }
  );
  return tried;
}
