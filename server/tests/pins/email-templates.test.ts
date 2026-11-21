// API pins for the two email template endpoints (server/src/routes/emailTemplates.ts): the list of templates and the
// preview of one, recorded on the code as it is (R-3). Read only, and nothing is sent: the test checks the outbound
// recorder of the test server did not grow while these ran.
//
// Who may call what, worked out from the route: the super admin only (it reads the raw `superadmin` role); the plain
// admin and everyone else get 403. The preview renders the template with its own sample data, so the answer carries the
// whole HTML (and the text version where there is one); the pins store each of the ten templates.
import { describe, expect, it } from "vitest";
import {
  as,
  everyRole,
  matrix,
  noTokenAnswers,
  outboundLines,
  pin,
  ROLES,
  type Role,
} from "./module-helpers";

const DIR = "api-email-templates";
const SUPER: Role = "superadmin";
const BASE = "/api/email-templates";
const IDS = [
  "recruiter-invitation",
  "confirm-signup",
  "onboarding-reminder",
  "jobseeker-welcome",
  "jobseeker-assignment",
  "jobseeker-removal",
  "timesheet",
  "invoice",
  "consent",
  "employment-agreement",
];

describe("GET /api/email-templates", () => {
  it("the list, and who may read it", async () => {
    const before = outboundLines().length;
    const m = await matrix(BASE, [SUPER], { fixedClock: true });
    expect(Object.keys(m.refused).sort()).toEqual(
      ROLES.filter((r) => r !== SUPER).sort()
    );
    expect((m.answer.answer as any[]).map((t) => t.id)).toEqual(IDS);
    await pin(DIR, 1, "list by role", m);
    expect(outboundLines().length).toBe(before);
  });
  it("no token is 401, a bad token 403", async () => {
    await pin(
      DIR,
      2,
      "list without a token",
      await noTokenAnswers(BASE, { fixedClock: true })
    );
  });
});

describe("GET /api/email-templates/:templateId/preview", () => {
  IDS.forEach((id, i) =>
    it(`renders ${id}`, async () => {
      const before = outboundLines().length;
      const r = await as(SUPER, `${BASE}/${id}/preview`, { fixedClock: true });
      expect(r.status).toBe(200);
      expect(r.json.id).toBe(id);
      expect(typeof r.json.html).toBe("string");
      await pin(DIR, 3 + i, `preview ${id}`, {
        status: r.status,
        answer: r.json,
      });
      // asking for a preview sends nothing
      expect(outboundLines().length).toBe(before);
    })
  );

  it("a template that is not there is 404", async () => {
    const r = await as(SUPER, `${BASE}/nope/preview`, { fixedClock: true });
    await pin(DIR, 20, "preview unknown", { status: r.status, answer: r.json });
  });

  it("only the super admin may preview; the answer of everyone else is the same refusal", async () => {
    const all = await everyRole(
      `${BASE}/timesheet/preview`,
      { fixedClock: true },
      ROLES.filter((r) => r !== SUPER)
    );
    for (const role of Object.keys(all))
      expect(all[role].status, role).toBe(403);
    await pin(DIR, 21, "preview refused by role", all);
  });

  it("no token is 401, a bad token 403", async () => {
    await pin(
      DIR,
      22,
      "preview without a token",
      await noTokenAnswers(`${BASE}/timesheet/preview`, { fixedClock: true })
    );
  });

  it("the previews are the same on a second ask", async () => {
    for (const id of IDS) {
      const [a, b] = [
        await as(SUPER, `${BASE}/${id}/preview`, { fixedClock: true }),
        await as(SUPER, `${BASE}/${id}/preview`, { fixedClock: true }),
      ];
      expect(b.json, id).toEqual(a.json);
    }
  });
});
