import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkAddress, requireLocal } from "../support/local-only.mjs";

const tests = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptsDir = path.join(tests, "scripts");

describe("checkAddress", () => {
  it.each([
    "http://127.0.0.1:54421",
    "http://localhost:54421",
    "HTTP://LOCALHOST:54421",
    "http://[::1]:54421",
    "postgresql://postgres:postgres@127.0.0.1:54422/postgres",
    "postgresql://postgres:postgres@localhost:5432/postgres",
    "postgresql://postgres:postgres@[::1]:5432/postgres",
  ])("accepts %s", (address) => {
    expect(checkAddress(address).ok).toBe(true);
  });

  it.each([
    // the real thing: hosted Supabase, in each form an address takes
    "https://abcdefghijklmnop.supabase.co",
    "postgresql://postgres:secret@db.abcdefghijklmnop.supabase.co:5432/postgres",
    "postgresql://postgres.abcdefghijklmnop:secret@aws-0-ca-central-1.pooler.supabase.com:6543/postgres",
    "https://example.com",
    // tricks that make a remote address look local
    "http://localhost@evil.example.com",
    "http://127.0.0.1@evil.example.com",
    "http://localhost.evil.example.com",
    "http://127.0.0.1.evil.example.com",
    "http://evil.example.com/localhost",
    "http://evil.example.com?host=localhost",
    "http://evil.example.com#127.0.0.1",
    "http://127.0.0.2",
    "http://0.0.0.0:54421",
    "http://[::2]:54421",
    "http://[::ffff:8.8.8.8]",
    "http://host.docker.internal:54421",
    // not an address at all
    "",
    "   ",
    "localhost",
    "127.0.0.1:54421",
    "not a url",
  ])("refuses %j", (address) => {
    expect(checkAddress(address).ok).toBe(false);
  });

  it("refuses a value that is not a string", () => {
    expect(checkAddress(undefined as never).ok).toBe(false);
    expect(checkAddress(null as never).ok).toBe(false);
    expect(checkAddress(5 as never).ok).toBe(false);
  });
});

describe("requireLocal", () => {
  it("returns for local addresses and an empty environment", () => {
    expect(() => requireLocal({ database: "postgresql://postgres@127.0.0.1:54422/postgres" }, {})).not.toThrow();
  });

  it("exits with code 2 for a remote address, before anything else runs", () => {
    const exit = vi_exit();
    expect(() => requireLocal({ database: "postgresql://x@db.example.supabase.co:5432/postgres" }, {})).toThrow("exit:2");
    expect(exit.restore()).toBe(2);
  });

  it("exits with code 2 when the environment still holds a remote address (stage or production left exported)", () => {
    for (const name of ["SUPABASE_URL", "DATABASE_URL", "SUPABASE_DB_URL", "POSTGRES_URL", "TEST_DB_URL", "TEST_SUPABASE_URL"]) {
      const exit = vi_exit();
      expect(() => requireLocal({}, { [name]: "https://abcdefghijklmnop.supabase.co" })).toThrow("exit:2");
      expect(exit.restore()).toBe(2);
    }
  });
});

function vi_exit() {
  const real = process.exit;
  const realError = console.error;
  let code: number | undefined;
  process.exit = ((c?: number) => {
    code = c;
    throw new Error(`exit:${c}`);
  }) as never;
  console.error = () => {};
  return {
    restore() {
      process.exit = real;
      console.error = realError;
      return code;
    },
  };
}

// Every entry point, run for real with a remote address in the environment: it must stop with exit
// code 2 and the refusal text, and must not get as far as touching Supabase or Docker.
describe("every test script refuses a remote database", () => {
  const scripts = readdirSync(scriptsDir).filter((f) => f.endsWith(".mjs"));

  it("finds the scripts it is meant to check", () => {
    expect(scripts).toEqual(expect.arrayContaining(["db-up.mjs", "db-build.mjs", "db-seed.mjs", "start-test-server.mjs"]));
  });

  const remote = {
    SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
    DATABASE_URL: "postgresql://postgres:secret@db.abcdefghijklmnop.supabase.co:5432/postgres",
  };

  for (const script of readdirSync(scriptsDir).filter((f) => f.endsWith(".mjs"))) {
    it.each(Object.entries(remote))(`${script} with ${"%s"} remote`, (name, value) => {
      const r = spawnSync(process.execPath, [path.join(scriptsDir, script)], {
        env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", [name]: value },
        encoding: "utf8",
        timeout: 20_000,
      });
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("REFUSED");
      expect(r.stderr).toContain(name);
      // it stopped before doing anything: none of the work a script announces was started
      expect(r.stdout).not.toMatch(/resetting|starting local|applied|seeded|test server on/i);
    });
  }

  it("the schema comparison refuses too", () => {
    const r = spawnSync(process.execPath, [path.join(tests, "schema/compare.mjs")], {
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", SUPABASE_URL: remote.SUPABASE_URL },
      encoding: "utf8",
      timeout: 20_000,
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("REFUSED");
  });
});

// A new script without the guard must fail here, not in a review.
describe("every test script starts with the guard", () => {
  for (const script of readdirSync(scriptsDir).filter((f) => f.endsWith(".mjs"))) {
    it(script, () => {
      const source = readFileSync(path.join(scriptsDir, script), "utf8");
      const guard = source.indexOf("requireLocal();");
      expect(guard, "calls requireLocal() at top level").toBeGreaterThan(-1);
      for (const risky of ["localStack(", "psql(", "supabase(", "startTestServer(", "fetch(", "spawn"]) {
        const first = source.indexOf(risky);
        if (first !== -1) expect(guard, `requireLocal() comes before ${risky}`).toBeLessThan(first);
      }
    });
  }
});
