// AI-5a: what the AI chat can read is decided by the database (migration 037), not by a word list in the AI
// service. Every test calls the four functions directly through the Data API with a user's own token, which is
// exactly what the AI service does, so a mistake in the service cannot widen what these allow.
// The synthetic data is used throughout; nothing here talks to an AI vendor.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PASSWORD,
  jobseekerEmails,
  staffEmails,
  stack,
  supabase,
  tokenFor,
} from "../support/api";
import { rolledBack } from "../support/rolled-back";

const rpc = (name: string, token: string | undefined, body: unknown = {}) =>
  supabase(`/rest/v1/rpc/${name}`, { token, method: "POST", body });
const run = async (token: string, query: string, row_cap?: number) =>
  rpc("ai_chat_run", token, row_cap ? { query, row_cap } : { query });
const rows = (r: { json: any }) => r.json?.rows;
const BODY: Record<string, unknown> = {
  ai_chat_schema: {},
  ai_chat_run: { query: "select 1 as n" },
  ai_chat_claim: { daily_limit: 5 },
  ai_chat_record_usage: { tokens_in: 1, tokens_out: 1 },
};
const service = () => ({ key: stack().serviceKey, token: stack().serviceKey });

// ---- the role-to-view map must equal client/src/constants/accessControl.ts ------------------------------------

function accessList(name: string): string[] {
  const file = path.resolve(
    __dirname,
    "../../../client/src/constants/accessControl.ts"
  );
  const src = readFileSync(file, "utf8");
  const m = src.match(
    new RegExp(`export const ${name}: AccessRole\\[\\] = \\[([^\\]]*)\\]`)
  );
  if (!m) throw new Error(`${name} not found in accessControl.ts`);
  return [...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
}

const PORTAL_ROLES = [
  "admin",
  "recruiter",
  "bookkeeper",
  "recruiter_manager",
  "accountant_manager",
  "sales",
  "recruiter_director",
] as const;

function expectedEntities(role: string): string[] {
  const js = accessList("JOBSEEKER_LIST_ROLES").includes(role);
  const cl = accessList("CLIENT_LIST_ROLES").includes(role);
  const po = accessList("POSITION_LIST_ROLES").includes(role);
  const ts = accessList("TIMESHEET_MANAGEMENT_ROLES").includes(role);
  const inv = accessList("INVOICE_MANAGEMENT_ROLES").includes(role);
  return [
    js && "jobseekers",
    cl && "clients",
    po && "positions",
    js && po && "assignments",
    ts && "timesheets",
    inv && "invoices",
  ].filter(Boolean) as string[];
}

const ALL_VIEWS = [
  "jobseekers",
  "clients",
  "positions",
  "assignments",
  "timesheets",
  "invoices",
];

describe("each portal role reads exactly the views its pages show (accessControl.ts)", () => {
  it.each(PORTAL_ROLES)("%s: the schema and the grants agree", async (role) => {
    const token = await tokenFor(staffEmails[role]);
    const want = expectedEntities(role).sort();
    expect(want.length).toBeGreaterThan(0);

    const schema = await rpc("ai_chat_schema", token);
    expect(schema.status, schema.text).toBe(200);
    expect(schema.json.map((v: any) => v.name).sort()).toEqual(want);
    for (const v of schema.json) {
      expect(v.comment, `${v.name} has a description`).toBeTruthy();
      expect(v.columns.length).toBeGreaterThan(2);
    }

    for (const view of ALL_VIEWS) {
      const r = await run(token, `select count(*) as n from ${view}`);
      if (want.includes(view)) {
        expect(r.json.ok, `${role} reads ${view}: ${r.text}`).toBe(true);
        expect(Number(rows(r)[0].n)).toBeGreaterThanOrEqual(0);
      } else {
        expect(r.json.ok, `${role} must not read ${view}`).toBe(false);
        expect(r.json.error).toBe("42501");
      }
    }
  });

  it("a user holding several roles gets the one that sees the most, never a mix", async () => {
    const email = `multi-${randomUUID().slice(0, 8)}@example.test`;
    const made = await supabase("/auth/v1/admin/users", {
      ...service(),
      method: "POST",
      body: {
        email,
        password: PASSWORD,
        email_confirm: true,
        app_metadata: {
          user_type: "recruiter",
          user_role: ["sales", "accountant", "recruiter_manager"],
        },
      },
    });
    expect(made.status, made.text).toBeLessThan(300);
    const token = await tokenFor(email);
    const schema = await rpc("ai_chat_schema", token);
    // bookkeeper (legacy "accountant") and recruiter_manager both see five; neither sees all six
    expect(schema.json.length).toBe(5);
  });
});

describe("what nobody can read through the chat, whoever asks", () => {
  const FORBIDDEN_TABLES = [
    "public.jobseeker_profiles",
    "public.clients",
    "public.timesheets",
    "public.ai_validation",
    "public.ai_chat_usage",
    "public.staff_2fa_sessions",
    "public.feature_flags",
    "public.recent_activities",
    "public.support_tickets",
    "public.consent_records",
    "auth.users",
    "auth.sessions",
    "storage.objects",
    "pg_catalog.pg_authid",
    "information_schema.columns",
    "net.http_request_queue",
    "net._http_response",
  ];

  it.each(FORBIDDEN_TABLES)("no role can read %s", async (table) => {
    for (const role of PORTAL_ROLES) {
      const token = await tokenFor(staffEmails[role]);
      const r = await run(token, `select * from ${table} limit 1`);
      expect(r.json.ok, `${role}: ${r.text}`).toBe(false);
      expect(["42501", "42P01", "AI_CHAT_FORBIDDEN_RELATION"]).toContain(
        r.json.error
      );
    }
  });

  it("a platform table every role can read in the database (pg_net's) is still refused, in a subquery and a join too", async () => {
    const token = await tokenFor(staffEmails.admin);
    for (const q of [
      "select (select count(*) from net._http_response) as n",
      "select j.id from jobseekers j, net.http_request_queue q limit 1",
      "with x as (select * from net.http_request_queue) select count(*) from x",
    ]) {
      const r = await run(token, q);
      expect(r.json, q).toMatchObject({
        ok: false,
        error: "AI_CHAT_FORBIDDEN_RELATION",
      });
    }
  });

  it.each(PORTAL_ROLES)(
    "the database role behind %s can SELECT exactly its views and nothing else, and write nothing",
    (role) => {
      const who = `'ai_chat_role_${role}'::regrole`;
      const rels = `from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast') and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')`;
      // Supabase's pg_net tables are readable by every role through PUBLIC; the runner refuses them (test above)
      const readable = rolledBack(
        `select coalesce(string_agg(n.nspname || '.' || c.relname, ',' order by c.relname), '') ${rels} and has_table_privilege(${who}, c.oid, 'SELECT') and n.nspname not in ('net', 'extensions', 'cron');`
      );
      expect(readable).toBe(
        expectedEntities(role)
          .sort()
          .map((e) => `ai_chat.${e}`)
          .join(",")
      );
      const writable = rolledBack(
        `select count(*) ${rels} and has_table_privilege(${who}, c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and n.nspname not in ('net', 'extensions', 'cron');`
      );
      expect(writable).toBe("0");
      const columns = rolledBack(
        `select count(*) from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and a.attnum > 0 and not a.attisdropped and has_column_privilege(${who}, c.oid, a.attnum, 'SELECT,INSERT,UPDATE');`
      );
      expect(columns).toBe("0");
      expect(
        rolledBack(
          `select rolsuper or rolcreaterole or rolcreatedb or rolbypassrls or rolcanlogin from pg_roles where oid = ${who}::oid;`
        )
      ).toBe("f");
    }
  );

  it("the fields the owner ruled out do not exist in any view", async () => {
    const token = await tokenFor(staffEmails.admin);
    const schema = await rpc("ai_chat_schema", token);
    const columns: string[] = schema.json.flatMap((v: any) =>
      v.columns.map((c: any) => `${v.name}.${c.name}`)
    );
    expect(columns.length).toBeGreaterThan(80);
    const forbidden =
      /(^|[._])(sin|sin_number|sin_expiry|dob|license_number|passport|business_number|corporation|bank|account_number|routing|institution|notes?|bio|street|postal|address|password|token|documents?|embedding|rejection_reason|work_permit|credit_limit|wsib|invoice_data|document_path|invoice_sent_to|contact_person|version_history)/i;
    const bad = columns.filter(
      (c) => forbidden.test(c) && c !== "positions.documents_required"
    );
    expect(bad).toEqual([]);
    // and asking for them by name fails in the database
    for (const field of [
      "sin_number",
      "dob",
      "passport_number",
      "license_number",
      "bio",
      "notes",
    ]) {
      const r = await run(token, `select ${field} from jobseekers`);
      expect(r.json.ok, `${field}`).toBe(false);
      expect(r.json.error).toBe("42703");
    }
  });

  it("the people views show the contact and pay fields the owner approved", async () => {
    const token = await tokenFor(staffEmails.admin);
    const r = await run(
      token,
      "select first_name, email, mobile, pay_rate, bill_rate from jobseekers order by created_at limit 3"
    );
    expect(r.json.ok, r.text).toBe(true);
    expect(rows(r).length).toBe(3);
    expect(rows(r)[0].email).toContain("@example.test");
    expect(
      typeof rows(r)[0].pay_rate === "number" || rows(r)[0].pay_rate === null
    ).toBe(true);
  });
});

describe("a question can never write, whatever it says", () => {
  const countOf = async (token: string, view: string) =>
    Number(rows(await run(token, `select count(*) as n from ${view}`))[0].n);

  const ATTACKS = [
    "delete from jobseekers",
    "update jobseekers set first_name = 'x'",
    "update ai_chat.jobseekers set first_name = 'x'",
    "insert into clients (company_name) values ('x')",
    "drop table public.clients",
    "drop view ai_chat.invoices",
    "truncate public.timesheets",
    "create table public.zzz (a int)",
    "select 1; delete from clients",
    "select 1) as x; delete from clients; select * from (select 1",
    "with d as (delete from clients returning *) select * from d",
    "select * into zzz from clients",
    "select * from clients for update",
    "copy clients to program 'true'",
    "do $$ begin delete from clients; end $$",
    "call ai_chat.caller_role()",
    "select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true)",
    "select ai_chat.caller_role()",
    "select public.ai_chat_run('select 1')",
    "select pg_read_file('/etc/passwd')",
    "select lo_import('/etc/passwd')",
  ];

  it.each(ATTACKS)("%s", async (attack) => {
    const token = await tokenFor(staffEmails.admin);
    const clientsBefore = await countOf(token, "clients");
    const jobseekersBefore = await countOf(token, "jobseekers");
    const r = await run(token, attack);
    // set_config is an ordinary function every role may call; what matters is that it grants nothing (below)
    if (!attack.startsWith("select set_config")) {
      expect(r.json.ok, `${attack}: ${r.text}`).toBe(false);
    }
    expect(await countOf(token, "clients")).toBe(clientsBefore);
    expect(await countOf(token, "jobseekers")).toBe(jobseekersBefore);
  });

  it("a recruiter cannot call another role's runner (nobody can call a runner from inside a question)", async () => {
    const token = await tokenFor(staffEmails.recruiter);
    for (const fn of ["run_admin", "run_recruiter"]) {
      const r = await run(
        token,
        `select ai_chat_run.${fn}('select count(*) from invoices', 5)`
      );
      expect(r.json.ok, `${fn}: ${r.text}`).toBe(false);
      expect(r.json.error).toBe("42501");
    }
    const comment = await run(
      token,
      "select 1 as n -- ) ; delete from clients"
    );
    expect(comment.json).toMatchObject({ ok: true, rows: [{ n: 1 }] });
  });

  it("a recruiter who forges the admin identity inside the question still reads only the recruiter's views", async () => {
    const token = await tokenFor(staffEmails.recruiter);
    const r = await run(
      token,
      `select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true), (select count(*) from invoices) as n`
    );
    expect(r.json.ok).toBe(false);
    expect(r.json.error).toBe("42501");
  });

  it("the real data really is unchanged after all of the above", () => {
    const out = rolledBack(
      "select (select count(*) from public.clients) || ',' || (select count(*) from public.jobseeker_profiles) || ',' || (select count(*) from public.timesheets) || ',' || exists (select 1 from public.clients where company_name = 'x') || ',' || exists (select 1 from public.jobseeker_profiles where first_name = 'x') || ',' || (to_regclass('public.zzz') is null);"
    );
    expect(out).toMatch(/^4,\d+,9,false,false,true$/);
  });

  it("the internal functions cannot be called by a signed-in user", () => {
    const out = rolledBack(
      `select has_function_privilege('authenticated', 'ai_chat.caller_role()', 'execute'), has_schema_privilege('authenticated', 'ai_chat', 'usage'), has_schema_privilege('authenticated', 'ai_chat_run', 'usage'), has_table_privilege('authenticated', 'ai_chat.jobseekers', 'select'), has_table_privilege('authenticated', 'public.ai_chat_usage', 'select');`
    );
    expect(out).toBe("f|f|f|f|f");
  });

  it("a runner role holds no write privilege anywhere", () => {
    const out = rolledBack(
      `select count(*) from information_schema.role_table_grants where grantee like 'ai_chat_role_%' and privilege_type <> 'SELECT';`
    );
    expect(out).toBe("0");
  });
});

describe("only signed-in staff", () => {
  it("no token (the public key only) is refused", async () => {
    for (const fn of Object.keys(BODY)) {
      const r = await rpc(fn, undefined, BODY[fn]);
      expect(r.status, `${fn}: ${r.text}`).toBeGreaterThanOrEqual(400);
    }
  });

  it("a jobseeker's token is refused, even after they edit their own user_metadata to admin", async () => {
    const token = await tokenFor(jobseekerEmails.sin);
    const r = await run(token, "select 1 as n");
    expect(r.status).toBe(400);
    expect(r.text).toContain("AI_CHAT_NOT_STAFF");
    const edit = await supabase("/auth/v1/user", {
      token,
      method: "PUT",
      body: { data: { user_type: "admin", user_role: ["admin"] } },
    });
    expect(edit.status).toBe(200);
    for (const fn of ["ai_chat_run", "ai_chat_schema"]) {
      const again = await rpc(fn, token, BODY[fn]);
      expect(again.text, fn).toContain("AI_CHAT_NOT_STAFF");
    }
  });

  it("a role taken away stops working at once, on the token already issued", async () => {
    const email = `demoted-${randomUUID().slice(0, 8)}@example.test`;
    const made = await supabase("/auth/v1/admin/users", {
      ...service(),
      method: "POST",
      body: {
        email,
        password: PASSWORD,
        email_confirm: true,
        app_metadata: { user_type: "recruiter", user_role: ["recruiter"] },
      },
    });
    expect(made.status, made.text).toBeLessThan(300);
    const token = await tokenFor(email);
    expect((await run(token, "select 1 as n")).json.ok).toBe(true);
    const demote = await supabase(`/auth/v1/admin/users/${made.json.id}`, {
      ...service(),
      method: "PUT",
      body: { app_metadata: { user_type: "jobseeker", user_role: [] } },
    });
    expect(demote.status, demote.text).toBeLessThan(300);
    const after = await run(token, "select 1 as n");
    expect(after.status).toBe(400);
    expect(after.text).toContain("AI_CHAT_NOT_STAFF");
  });
});

describe("the staff phone code (two-step login) is required while it is enforced", () => {
  const flag = (enabled: boolean | null) =>
    supabase(
      enabled === null
        ? "/rest/v1/feature_flags?key=eq.staff_two_factor_enforced"
        : "/rest/v1/feature_flags?on_conflict=key",
      {
        ...service(),
        method: enabled === null ? "DELETE" : "POST",
        body:
          enabled === null
            ? undefined
            : [{ key: "staff_two_factor_enforced", enabled }],
        headers:
          enabled === null
            ? undefined
            : { Prefer: "resolution=merge-duplicates" },
      }
    );
  const sessionOf = (token: string) =>
    JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
      .session_id as string;
  const record = (session: string, user: string, daysAgo = 0) =>
    supabase("/rest/v1/staff_2fa_sessions?on_conflict=session_id", {
      ...service(),
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: [
        {
          session_id: session,
          user_id: user,
          verified_at: new Date(
            Date.now() - daysAgo * 86_400_000
          ).toISOString(),
        },
      ],
    });

  afterAll(async () => {
    await flag(false); // the test seed stores the flag off (like stage)
  });

  it("refuses a password-only session, accepts a verified one, refuses a stale or someone else's", async () => {
    const email = `twofa-${randomUUID().slice(0, 8)}@example.test`;
    const made = await supabase("/auth/v1/admin/users", {
      ...service(),
      method: "POST",
      body: {
        email,
        password: PASSWORD,
        email_confirm: true,
        app_metadata: { user_type: "recruiter", user_role: ["recruiter"] },
      },
    });
    const userId = made.json.id as string;
    const token = await tokenFor(email);
    const session = sessionOf(token);
    try {
      expect((await flag(true)).status).toBeLessThan(300);
      for (const fn of ["ai_chat_run", "ai_chat_schema", "ai_chat_claim"]) {
        const r = await rpc(fn, token, BODY[fn]);
        expect(r.status, fn).toBe(400);
        expect(r.text, fn).toContain("AI_CHAT_TWO_FACTOR_REQUIRED");
      }

      // a session recorded for another user does not count
      expect(
        (await record(session, "00000000-0000-4000-8000-000000000001")).status
      ).toBeLessThan(300);
      expect((await run(token, "select 1 as n")).text).toContain(
        "AI_CHAT_TWO_FACTOR_REQUIRED"
      );

      // older than 90 days does not count
      expect((await record(session, userId, 100)).status).toBeLessThan(300);
      expect((await run(token, "select 1 as n")).text).toContain(
        "AI_CHAT_TWO_FACTOR_REQUIRED"
      );

      // verified: works
      expect((await record(session, userId, 1)).status).toBeLessThan(300);
      const ok = await run(token, "select 1 as n");
      expect(ok.json.ok, ok.text).toBe(true);

      // another sign-in of the same person (new session id) is not verified
      const second = await supabase("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: { email, password: PASSWORD },
      });
      expect(sessionOf(second.json.access_token)).not.toBe(session);
      expect(
        (await run(second.json.access_token, "select 1 as n")).text
      ).toContain("AI_CHAT_TWO_FACTOR_REQUIRED");

      // flag removed (the default is on) behaves like on; flag off lets it through
      expect((await flag(null)).status).toBeLessThan(300);
      expect(
        (await run(second.json.access_token, "select 1 as n")).text
      ).toContain("AI_CHAT_TWO_FACTOR_REQUIRED");
      expect((await flag(false)).status).toBeLessThan(300);
      expect(
        (await run(second.json.access_token, "select 1 as n")).json.ok
      ).toBe(true);
    } finally {
      await flag(false);
    }
  });
});

describe("limits", () => {
  it("caps the rows (500 at most), tells the caller it was cut, and caps the size", async () => {
    const token = await tokenFor(staffEmails.admin);
    const cut = await run(
      token,
      "select n from generate_series(1, 1000) as n",
      5
    );
    expect(cut.json).toMatchObject({ ok: true, truncated: true });
    expect(rows(cut).map((r: any) => r.n)).toEqual([1, 2, 3, 4, 5]);

    const most = await run(
      token,
      "select n from generate_series(1, 1000) as n",
      100000
    );
    expect(rows(most).length).toBe(500);
    expect(most.json.truncated).toBe(true);

    const exact = await run(
      token,
      "select n from generate_series(1, 5) as n",
      5
    );
    expect(exact.json).toMatchObject({ ok: true, truncated: false });

    const big = await run(token, "select repeat('x', 500000) as s");
    expect(big.json).toMatchObject({
      ok: false,
      error: "AI_CHAT_TOO_MUCH_DATA",
    });
  });

  it("stops a query that runs too long (the Data API's own statement timeout)", async () => {
    const token = await tokenFor(staffEmails.admin);
    const started = Date.now();
    const r = await run(token, "select pg_sleep(60)");
    expect(Date.now() - started).toBeLessThan(20_000);
    expect(r.json?.ok === true, r.text).toBe(false);
  }, 30_000);

  it("counts questions per day against the limit and adds up the tokens", async () => {
    const token = await tokenFor(staffEmails.admin);
    await supabase("/rest/v1/ai_chat_usage?day=gte.2000-01-01", {
      ...service(),
      method: "DELETE",
    });
    const claims = [];
    for (let i = 0; i < 4; i++)
      claims.push((await rpc("ai_chat_claim", token, { daily_limit: 3 })).json);
    expect(claims.map((c) => c.allowed)).toEqual([true, true, true, false]);
    expect(claims[3].used).toBe(3);

    expect(
      (
        await rpc("ai_chat_record_usage", token, {
          tokens_in: 1200,
          tokens_out: 80,
        })
      ).status
    ).toBeLessThan(300);
    expect(
      (
        await rpc("ai_chat_record_usage", token, {
          tokens_in: 300,
          tokens_out: 20,
        })
      ).status
    ).toBeLessThan(300);
    const usage = await supabase("/rest/v1/ai_chat_usage", service());
    expect(usage.json).toHaveLength(1);
    expect(usage.json[0]).toMatchObject({
      questions: 3,
      input_tokens: 1500,
      output_tokens: 100,
    });
    // staff cannot read or change the table themselves
    expect(
      (await supabase("/rest/v1/ai_chat_usage", { token })).status
    ).toBeGreaterThanOrEqual(400);
    const forge = await supabase("/rest/v1/ai_chat_usage?day=gte.2000-01-01", {
      token,
      method: "PATCH",
      body: { questions: 0 },
    });
    expect(
      forge.status === 401 ||
        forge.status === 403 ||
        (forge.json ?? []).length === 0
    ).toBe(true);
    await supabase("/rest/v1/ai_chat_usage?day=gte.2000-01-01", {
      ...service(),
      method: "DELETE",
    });
  });
});
