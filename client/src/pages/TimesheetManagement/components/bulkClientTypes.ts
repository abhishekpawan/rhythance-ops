import type { useLanguage } from "../../../contexts/language/language-provider";
import type { useBulkTimesheetForms } from "../hooks/useBulkTimesheetForms";
import type { useBulkTimesheetSelection } from "../hooks/useBulkTimesheetSelection";
import type { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";

export type BulkT = ReturnType<typeof useLanguage>["t"];
export type BulkTf = ReturnType<typeof useTimesheetFormTranslation>;
export type BulkSelection = ReturnType<typeof useBulkTimesheetSelection>;
export type BulkForms = ReturnType<typeof useBulkTimesheetForms>;
export type BulkRows = BulkForms["rows"];
export type BulkRow = BulkRows[number];
