import type { BulkPositionRow } from "../types";

export function newEmptyRow(): BulkPositionRow {
  const rowId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  return {
    rowId,
    position: null,
    form: null,
    formLoading: false,
    emailSent: false,
  };
}
