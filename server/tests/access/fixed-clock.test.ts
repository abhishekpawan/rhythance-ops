// Date-based answers: the fixed-clock server answers as if it were 10:00 on 17 November 2026 in Toronto,
// whatever day the tests run; the default server uses the real clock.
import { inject, describe, expect, it } from "vitest";
import { FIXED_NOW } from "../seed/ids.mjs";
import { staffEmails, tokenFor } from "../support/api";

const get = async (base: string, path: string) =>
  (
    await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${await tokenFor(staffEmails.admin)}` },
    })
  ).json() as Promise<any>;

describe("the fixed clock", () => {
  it("the fixed-clock server reports the fixed instant", async () => {
    const a = await get(
      inject("fixedClockServerUrl"),
      "/api/metrics/jobseekers/expiry-status-counts"
    );
    expect(a.generatedAt).toBe(FIXED_NOW);
  });

  it("the default server reports the real time", async () => {
    const before = Date.now();
    const a = await get(
      inject("serverUrl"),
      "/api/metrics/jobseekers/expiry-status-counts"
    );
    const at = new Date(a.generatedAt).getTime();
    expect(at).toBeGreaterThanOrEqual(before - 5000);
    expect(at).toBeLessThanOrEqual(Date.now() + 5000);
  });
});
