import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const clock = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../support/fixed-clock.mjs");
const run = (env: Record<string, string>) =>
  JSON.parse(
    spawnSync(
      process.execPath,
      [
        "--import", clock, "-e",
        `console.log(JSON.stringify({ now: new Date().toISOString(), ms: Date.now(), explicit: new Date("2020-01-02T03:04:05Z").toISOString(),
          arg: new Date(2020, 0, 2).getFullYear(), instance: new Date() instanceof Date, toronto: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", dateStyle: "short" }).format(new Date()) }))`,
      ],
      { env: { PATH: process.env.PATH ?? "", ...env }, encoding: "utf8" }
    ).stdout
  );

describe("fixed-clock preload", () => {
  it("makes now stand still, and leaves explicit dates alone", () => {
    const r = run({ TEST_FIXED_NOW: "2026-11-17T15:00:00.000Z" });
    expect(r.now).toBe("2026-11-17T15:00:00.000Z");
    expect(r.ms).toBe(Date.parse("2026-11-17T15:00:00.000Z"));
    expect(r.explicit).toBe("2020-01-02T03:04:05.000Z");
    expect(r.arg).toBe(2020);
    expect(r.instance).toBe(true);
    expect(r.toronto).toBe("2026-11-17");
  });
  it("does nothing without TEST_FIXED_NOW", () => {
    const r = run({});
    expect(Math.abs(r.ms - Date.now())).toBeLessThan(10_000);
  });
});
