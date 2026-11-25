import { getPositionDisplayTitle } from "../../../utils/positionDisplay";
import type {
  BulkJsRows,
  BulkJsSelection,
  BulkJsSubmit,
  BulkJsT,
} from "../components/bulkJobseekerTypes";

interface UseBulkJobseekerGenerateParams {
  t: BulkJsT;
  rows: BulkJsRows;
  selectedJobseeker: BulkJsSelection["selectedJobseeker"];
  selectedClient: BulkJsSelection["selectedClient"];
  selectedWeekStart: BulkJsSelection["selectedWeekStart"];
  unknownPositionFallback: string;
  setGenerationError: BulkJsSubmit["setGenerationError"];
  generateBulkTimesheets: BulkJsSubmit["generateBulkTimesheets"];
}

/** The "generate" click: checks the context, builds the payloads, starts the submit. */
export function useBulkJobseekerGenerate({
  t,
  rows,
  selectedJobseeker,
  selectedClient,
  selectedWeekStart,
  unknownPositionFallback,
  setGenerationError,
  generateBulkTimesheets,
}: UseBulkJobseekerGenerateParams) {
  const handleGenerate = () => {
    if (
      !selectedJobseeker ||
      !selectedClient ||
      !selectedWeekStart ||
      rows.length === 0
    ) {
      setGenerationError(
        t(
          "bulkJobseekerTimesheetManagement.messages.contextIncompleteForGenerate"
        )
      );

      return;
    }

    const payloads = rows

      .filter(
        (row) =>
          row.position &&
          row.form &&
          row.form.totalRegularHours + row.form.totalOvertimeHours > 0
      )

      .map((row) => ({
        form: row.form!,

        emailSent: row.emailSent,

        clientPosition: row.position!,

        jobseeker: selectedJobseeker,

        progressLabel: `${getPositionDisplayTitle(row.position!, unknownPositionFallback)} (${row.position!.positionCode ?? ""})`,
      }));

    if (payloads.length === 0) {
      setGenerationError(
        t("bulkJobseekerTimesheetManagement.messages.noRowsWithHours")
      );

      return;
    }

    void generateBulkTimesheets(payloads, selectedWeekStart);
  };

  return handleGenerate;
}
