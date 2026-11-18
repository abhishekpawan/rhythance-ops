import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const support = path.resolve(here, "../support");

let dir: string;
let log: string;
let result: Record<string, { ok: boolean; value?: unknown; error?: string }>;
let recorded: Array<Record<string, unknown>>;

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "outbound-probe-"));
  log = path.join(dir, "outbound.jsonl");
  writeFileSync(log, "");
  const r = spawnSync(
    process.execPath,
    ["--import", path.join(support, "outbound-guard.mjs"), path.join(here, "fixtures/outbound-probe.mjs")],
    { cwd: dir, env: { PATH: process.env.PATH ?? "", TEST_OUTBOUND_LOG: log }, encoding: "utf8", timeout: 60_000 }
  );
  expect(r.status, r.stderr).toBe(0);
  result = JSON.parse(r.stdout.trim().split("\n").pop() as string);
  recorded = readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("the outbound guard", () => {
  it("records emails instead of sending them", () => {
    expect(result.sendgrid).toEqual({ ok: true, value: 202 });
    expect(result["sendgrid-dynamic-import"]).toEqual({ ok: true, value: 202 });
    const mails = recorded.filter((e) => e.kind === "email");
    expect(mails).toHaveLength(2);
    expect(mails[0]).toMatchObject({ to: ["someone@example.test"], subject: "Hello", from: "no-reply@example.test" });
    expect(mails[1]).toMatchObject({ to: ["a@example.test", "b@example.test"], subject: "Two" });
  });

  it("records SMS codes instead of sending them, and approves only the test code", () => {
    expect(result["twilio-send"]).toEqual({ ok: true, value: "pending" });
    expect(result["twilio-check-wrong"]).toEqual({ ok: true, value: "pending" });
    expect(result["twilio-check-right"]).toEqual({ ok: true, value: "approved" });
    expect(recorded.filter((e) => e.kind === "sms")).toEqual([expect.objectContaining({ to: "+15555550100", channel: "sms" })]);
  });

  it.each([
    "fetch-sendgrid",
    "fetch-openai",
    "https-request-twilio",
    "http-request-remote",
    "net-connect-ip",
    "net-connect-port-host",
  ])("blocks %s", (name) => {
    expect(result[name].ok).toBe(false);
    expect(result[name].error).toMatch(/blocked by the test guard/);
  });

  it("records what it blocked, so a test can see the server tried", () => {
    const hosts = recorded.filter((e) => String(e.kind).startsWith("blocked")).map((e) => e.host);
    expect(hosts).toEqual(expect.arrayContaining(["api.sendgrid.com", "api.openai.com", "verify.twilio.com", "example.com", "8.8.8.8"]));
  });

  it("lets localhost through (the server talks to the local Supabase)", () => {
    expect(result["fetch-localhost"]).toEqual({ ok: true, value: "local ok" });
    expect(result["http-localhost"]).toEqual({ ok: true, value: "local ok" });
  });
});
