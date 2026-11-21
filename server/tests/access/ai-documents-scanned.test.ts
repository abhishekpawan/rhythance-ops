// DEV-3: the AI insights card "documents scanned" counts finished checks only. A check that failed is stored
// (when the AI service keeps those) as ai_response.check_status = "not_checked" and has scanned nothing.
import { randomUUID } from "node:crypto";
import { describe, expect, it, inject } from "vitest";
import { server, staffEmails, supabase, tokenFor } from "../support/api";

const row = (ai_response: unknown) => ({
  document_id: randomUUID(),
  ai_response,
  input_tokens: 0,
  output_tokens: 0,
  llm_model_name: "test",
  document_status: "active",
});

describe("AI insights: documents scanned", () => {
  it("counts a finished check and an old row, not a not-checked row", async () => {
    const token = await tokenFor(staffEmails.admin);
    const count = async () =>
      (await server("/api/ai/insights", { token })).json.totalDocumentsScanned;
    const before = await count();
    const added = await supabase("/rest/v1/ai_validation", {
      key: inject("stack").serviceKey,
      method: "POST",
      body: [
        row({ document_authentication_percentage: 90 }),
        row({
          check_status: "checked",
          document_authentication_percentage: 80,
        }),
        row({
          check_status: "not_checked",
          not_checked_reason: "vendor_quota",
        }),
      ],
    });
    expect(added.status, added.text).toBeLessThan(300);
    expect(await count()).toBe(before + 2);
  });
});
