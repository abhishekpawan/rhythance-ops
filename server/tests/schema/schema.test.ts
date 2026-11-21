// The schema built from migration_v2 is production's schema (apart from what 032 lists as not covered and
// files-ahead-of-production.txt), and 032 to 035 and 037 to 040 can run again without changing anything.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  compareListings,
  formatResult,
  listLocal,
  readAllowances,
  readLines,
  NOT_COVERED,
} from "./compare.mjs";
import { MIGRATIONS_DIR, psql } from "../support/stack.mjs";
import { stack } from "../support/api";

const here = path.dirname(fileURLToPath(import.meta.url));
const production = readLines(path.join(here, "production-listing.txt"));
const ahead = readAllowances(path.join(here, "files-ahead-of-production.txt"));
const changed = readAllowances(
  path.join(here, "changed-ahead-of-production.txt")
);

describe("schema comparison", () => {
  it("matches production", async () => {
    const result = compareListings(
      production,
      await listLocal(),
      ahead,
      changed
    );
    expect(formatResult(result), "differences").toBe("");
  });

  it("notices a missing object, an extra object and a stale allowance", () => {
    const local = production.filter(
      (l) => !NOT_COVERED.some((re) => re.test(l))
    );
    const extraLine = "table|public.invented|kind=r rls=true";
    const withAllowed = [...local, ...ahead.map((p) => `${p}x`)];
    expect(compareListings(production, withAllowed, ahead)).toEqual({
      missing: [],
      extra: [],
      staleAllowances: [],
    });
    expect(
      compareListings(production, [...withAllowed, extraLine], ahead).extra
    ).toEqual([extraLine]);
    const dropped = withAllowed.filter(
      (l) => !l.startsWith("column|public.clients.company_name|")
    );
    expect(compareListings(production, dropped, ahead).missing).toHaveLength(1);
    expect(compareListings(production, local, ahead).staleAllowances).toEqual(
      ahead
    );
  });

  it("accepts a newer definition in the files only while production still has the old one", () => {
    const fn = "function|public.find_matching_candidates(";
    const old = production.find((l) => l.startsWith(fn)) as string;
    const newer = old.replace(/body=\w+$/, "body=0");
    const covered = production.filter(
      (l) => !NOT_COVERED.some((re) => re.test(l))
    );
    const local = [...covered.filter((l) => l !== old), newer];
    expect(compareListings(production, local, [], [fn])).toEqual({
      missing: [],
      extra: [],
      staleAllowances: [],
    });
    // without the allowance both lines are reported
    const bare = compareListings(production, local, [], []);
    expect(bare.missing).toEqual([old]);
    expect(bare.extra).toEqual([newer]);
    // once production has the new definition the allowance is stale and must go
    expect(
      compareListings(
        [...covered.filter((l) => l !== old), newer],
        local,
        [],
        [fn]
      ).staleAllowances
    ).toEqual([fn]);
  });

  it("ignores exactly the items 032 lists as not covered", () => {
    const text = readFileSync(
      path.join(MIGRATIONS_DIR, "032_catch_up_to_production.sql"),
      "utf8"
    );
    expect(text).toContain("process-embeddings");
    expect(NOT_COVERED).toHaveLength(3);
    const ignoredInProduction = production.filter((l) =>
      NOT_COVERED.some((re) => re.test(l))
    );
    expect(
      ignoredInProduction.map((l) => l.split("|").slice(0, 2).join("|")).sort()
    ).toEqual(
      [
        "cron|process-embeddings",
        "fngrant|public.embedding_input_jobseeker_bio(pre_embedding_text jobseeker_profiles)",
        "fngrant|public.embedding_input_position_description(pre_embedding_text positions)",
        "function|public.embedding_input_jobseeker_bio(pre_embedding_text jobseeker_profiles)",
        "function|public.embedding_input_position_description(pre_embedding_text positions)",
        "trigger|public.jobseeker_profiles.embed_bio_on_insert",
        "trigger|public.jobseeker_profiles.embed_bio_on_update",
        "trigger|public.positions.embed_job_description_on_insert",
        "trigger|public.positions.embed_job_description_on_update",
      ].sort()
    );
  });
});

describe("migrations 032 to 035 and 037 to 040 run twice", () => {
  it("change nothing the second time, and nothing fails", async () => {
    const before = (await listLocal()).sort();
    for (const file of [
      "032_catch_up_to_production.sql",
      "033_close_public_access.sql",
      "034_roles_from_app_metadata.sql",
      "035_staff_two_factor.sql",
      "037_ai_chat_read_layer.sql",
      "038_drop_unused_ai_functions.sql",
      "032_catch_up_to_production.sql",
      // last: 034 and 032 put back the old role helpers and the invoice policies that 039 replaces or removes
      "039_staff_session_in_database_rules.sql",
      // 032 also puts back three invoice policies that read auth.users; 040 removes them again
      "040_drop_dead_staff_policies.sql",
    ]) {
      const r = psql(stack().dbUrl, { file: path.join(MIGRATIONS_DIR, file) });
      expect(
        r.status,
        `${file}: ${r.stderr
          .split("\n")
          .filter((l: string) => !l.includes("NOTICE"))
          .join("\n")}`
      ).toBe(0);
    }
    expect((await listLocal()).sort()).toEqual(before);
  });
});

describe("the database has no embedding or chat-SQL machinery that could call out", () => {
  const q = (sql: string) => {
    const r = psql(stack().dbUrl, {
      sql,
      tuplesOnly: true,
      singleTransaction: false,
    });
    expect(r.status, r.stderr).toBe(0);
    return r.stdout.trim();
  };

  it("has no execute_sql, no embedding queue, no pgmq", () => {
    expect(
      q(
        "select count(*) from pg_proc where proname in ('execute_sql', 'queue_embeddings', 'process_embeddings')"
      )
    ).toBe("0");
    expect(
      q("select count(*) from pg_namespace where nspname in ('util', 'pgmq')")
    ).toBe("0");
    expect(q("select count(*) from pg_extension where extname = 'pgmq'")).toBe(
      "0"
    );
  });

  it("has no function, trigger or scheduled job that makes an HTTP call from inside Postgres", () => {
    // pg_net itself ships with Supabase; what matters is that nothing in the schema uses it
    expect(
      q(
        "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'util') and p.prosrc ~* '(net\\.http_|http_post|http_get)'"
      )
    ).toBe("0");
    expect(
      q(
        "select count(*) from cron.job where command ~* '(net\\.http_|http_post|embedding)'"
      )
    ).toBe("0");
  });
});

describe("migration 032 refuses to run without an explicit opt-in", () => {
  const run = (pgoptions: string | undefined) => {
    const env: Record<string, string> = {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      PGPASSWORD: "postgres",
    };
    if (pgoptions !== undefined) env.PGOPTIONS = pgoptions;
    return spawnSync(
      "psql",
      [
        stack().dbUrl,
        "-X",
        "-q",
        "-v",
        "ON_ERROR_STOP=1",
        "--single-transaction",
        "-f",
        path.join(MIGRATIONS_DIR, "032_catch_up_to_production.sql"),
      ],
      { env, encoding: "utf8" }
    );
  };

  it("fails with the reason and a pointer to the README when the opt-in is missing or wrong", async () => {
    const before = (await listLocal()).sort();
    for (const options of [
      undefined,
      "-c rhythence.catch_up=yes",
      "-c rhythence.catch_up=",
    ]) {
      const r = run(options);
      expect(r.status, String(options)).not.toBe(0);
      expect(r.stderr).toContain("NEW databases");
      expect(r.stderr).toContain("must never be run on a live database");
      expect(r.stderr).toContain("migration_v2/README.md");
    }
    expect((await listLocal()).sort()).toEqual(before);
  });

  it("runs with the opt-in", () => {
    expect(run("-c rhythence.catch_up=new-database").status).toBe(0);
    // 032 put back the three invoice policies 040 drops; leave the database as the build leaves it
    const r = psql(stack().dbUrl, {
      file: path.join(MIGRATIONS_DIR, "040_drop_dead_staff_policies.sql"),
    });
    expect(r.status, r.stderr).toBe(0);
  });
});

describe("no policy in public reads auth.users or raw_user_meta_data (migration 040)", () => {
  const q = (sql: string) => {
    const r = psql(stack().dbUrl, {
      sql,
      tuplesOnly: true,
      singleTransaction: false,
    });
    expect(r.status, r.stderr).toBe(0);
    return r.stdout.trim();
  };
  const READS_USERS =
    "(coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* 'auth\\.users|raw_user_meta_data'";

  it("none does: a signed-in user could edit raw_user_meta_data, and the policies built on it never grant anything", () => {
    expect(
      q(
        `select coalesce(string_agg(tablename || ': ' || policyname, E'\\n'), '') from pg_policies where schemaname = 'public' and ${READS_USERS}`
      )
    ).toBe("");
  });

  it("the stored production listing has none either (so a policy of that kind cannot come back through a refresh)", () => {
    expect(
      production.filter(
        (l) =>
          l.startsWith("policy|public.") &&
          /auth\.users|raw_user_meta_data/.test(l)
      )
    ).toEqual([]);
  });

  it("the migration fails, and drops nothing, when a policy of that kind exists (the guard)", () => {
    const file = path.join(MIGRATIONS_DIR, "040_drop_dead_staff_policies.sql");
    const count = () =>
      q("select count(*) from pg_policies where schemaname = 'public'");
    q(
      `create table public.zz_040_probe (id int); alter table public.zz_040_probe enable row level security; create policy "zz probe" on public.zz_040_probe for select using (auth.uid() in (select id from auth.users where raw_user_meta_data->>'user_type' = 'admin'))`
    );
    try {
      const before = count();
      const r = psql(stack().dbUrl, { file });
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain("040: policies still reading auth.users");
      expect(r.stderr).toContain("zz_040_probe");
      expect(count()).toBe(before);
    } finally {
      q("drop table public.zz_040_probe");
    }
  });
});
