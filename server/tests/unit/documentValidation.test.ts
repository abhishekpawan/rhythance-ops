// DEV-3: which `ai_validation` rows the staff jobseeker profile shows for a document.
import { describe, expect, it } from "vitest";
import { validationByDocument } from "../../src/utils/documentValidation";

const checked = { document_authentication_percentage: 92, is_tampered: false };

describe("validationByDocument", () => {
  it("returns a finished check with its status", () => {
    expect(
      validationByDocument([
        { document_id: "d1", ai_response: checked, document_status: "active" },
      ])
    ).toEqual({ d1: { ...checked, document_status: "active" } });
  });

  it("shows a failed check as not_checked with its reason and no percentage", () => {
    const r = validationByDocument([
      {
        document_id: "d1",
        ai_response: {
          check_status: "not_checked",
          not_checked_reason: "vendor_quota",
        },
        document_status: "active",
      },
    ]);
    expect(r.d1).toEqual({
      check_status: "not_checked",
      not_checked_reason: "vendor_quota",
      document_status: "active",
    });
    expect(r.d1.document_authentication_percentage).toBeUndefined();
  });

  it("an inactive row never overrides the active one, whichever comes last", () => {
    const active = {
      document_id: "d1",
      ai_response: checked,
      document_status: "active",
    };
    const inactive = {
      document_id: "d1",
      ai_response: { document_authentication_percentage: 5, is_tampered: true },
      document_status: "inactive",
    };
    expect(validationByDocument([active, inactive]).d1).toMatchObject({
      document_authentication_percentage: 92,
    });
    expect(validationByDocument([inactive, active]).d1).toMatchObject({
      document_authentication_percentage: 92,
    });
  });

  it("a document that has only an inactive row has no answer (it is checked again)", () => {
    expect(
      validationByDocument([
        {
          document_id: "d1",
          ai_response: checked,
          document_status: "inactive",
        },
      ])
    ).toEqual({});
  });

  it("an old row with no status still counts", () => {
    expect(
      validationByDocument([
        { document_id: "d1", ai_response: checked, document_status: null },
      ]).d1
    ).toMatchObject({ document_authentication_percentage: 92 });
  });
});
