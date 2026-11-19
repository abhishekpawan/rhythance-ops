// Proof that the journeys can only run on this machine (refactor plan D1a, applied to the browser).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "../support/fixtures";

const startClient = path.resolve("support/start-client.mjs");
const LOCAL = {
  VITE_SUPABASE_URL: "http://127.0.0.1:54421",
  VITE_API_URL: "http://127.0.0.1:5001",
  VITE_AI_CHAT_URL: "http://127.0.0.1:9",
  E2E_CLIENT_PORT: "5999",
};

function tryToStart(env: Record<string, string>) {
  // an explicit environment, and an empty folder to run in: nothing of the developer's shell reaches it
  return spawnSync(process.execPath, [startClient], {
    env: { PATH: process.env.PATH ?? "", ...env },
    encoding: "utf8",
    timeout: 20_000,
  });
}

test.describe("the client refuses to start against a remote address (exit code 2)", () => {
  for (const [name, remote] of [
    ["Supabase", { VITE_SUPABASE_URL: "https://abc.supabase.co" }],
    ["the API", { VITE_API_URL: "https://ops.onrender.com" }],
    ["the AI chat", { VITE_AI_CHAT_URL: "https://ai.onrender.com" }],
    [
      "an address that only starts with localhost",
      { VITE_API_URL: "http://localhost@evil.example" },
    ],
  ] as const) {
    test(name, () => {
      const r = tryToStart({ ...LOCAL, ...remote });
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("REFUSED");
    });
  }
});

test.describe("every request to another host is aborted and counted", () => {
  test("a fetch to a host outside this machine never gets an answer", async ({
    page,
    outsideRequests,
  }) => {
    await page.goto("/login");
    // fonts.googleapis.com is one of the hosts the app asks for itself (KNOWN_OUTSIDE_HOSTS)
    const result = await page.evaluate(() =>
      fetch("https://fonts.googleapis.com/css2?family=Inter")
        .then(() => "answered")
        .catch(() => "blocked")
    );
    expect(result).toBe("blocked");
    expect(outsideRequests.map((r) => r.host)).toContain(
      "fonts.googleapis.com"
    );
  });

  // an unknown host makes the test fail: test.fail() says this one is expected to
  test.fail(
    "a host nobody listed fails the test that tried it",
    async ({ page }) => {
      await page.goto("/login");
      await page.evaluate(() =>
        fetch("https://analytics.example.invalid/collect").catch(
          () => "blocked"
        )
      );
    }
  );
});
