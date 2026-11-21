// The AI service keeps one `ai_validation` row per checked document. When a document leaves the profile its
// row is marked `inactive` (godspeed-ops-ai, `mark_document_inactive`); a row with no status is an old one.
// A profile shows only the rows that still count: an inactive row must never stand in for, or override, the
// document's current answer.
export interface AiValidationRow {
  document_id: string;
  ai_response: Record<string, unknown> | null;
  document_status?: string | null;
}

/** document id -> the stored answer (a finished check, or `check_status: "not_checked"`) plus its document_status. */
export function validationByDocument(
  rows: AiValidationRow[]
): Record<string, Record<string, unknown>> {
  const byDocument: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    if (row.document_status === "inactive") continue;
    byDocument[row.document_id] = {
      ...row.ai_response,
      document_status: row.document_status,
    };
  }
  return byDocument;
}
