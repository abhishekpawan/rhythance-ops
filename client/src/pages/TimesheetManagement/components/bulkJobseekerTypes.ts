import type { useLanguage } from "../../../contexts/language/language-provider";
import type { useBulkJobseekerPositionForms } from "../hooks/useBulkJobseekerPositionForms";
import type { useBulkJobseekerTimesheetSelection } from "../hooks/useBulkJobseekerTimesheetSelection";
import type { useBulkTimesheetSubmit } from "../hooks/useBulkTimesheetSubmit";
import type { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";

export type BulkJsT = ReturnType<typeof useLanguage>["t"];
export type BulkJsTf = ReturnType<typeof useTimesheetFormTranslation>;
export type BulkJsSelection = ReturnType<
  typeof useBulkJobseekerTimesheetSelection
>;
export type BulkJsForms = ReturnType<typeof useBulkJobseekerPositionForms>;
export type BulkJsRows = BulkJsForms["rows"];
export type BulkJsSubmit = ReturnType<typeof useBulkTimesheetSubmit>;
