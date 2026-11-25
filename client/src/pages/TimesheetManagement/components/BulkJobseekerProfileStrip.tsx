import { Plus } from "lucide-react";
import { TimesheetJobseekerInfoPanel } from "./TimesheetJobseekerInfoPanel";
import type {
  BulkJsForms,
  BulkJsSelection,
  BulkJsT,
} from "./bulkJobseekerTypes";

interface BulkJobseekerProfileStripProps {
  t: BulkJsT;
  selectedJobseeker: NonNullable<BulkJsSelection["selectedJobseeker"]>;
  showAddRow: boolean;
  addRow: BulkJsForms["addRow"];
}

/** The chosen jobseeker's details and the "add another position" button. */
export function BulkJobseekerProfileStrip({
  t,
  selectedJobseeker,
  showAddRow,
  addRow,
}: BulkJobseekerProfileStripProps) {
  return (
    <div className="bulk-jobseeker-profile-strip timesheet-assignment-card bulk-jobseeker-employee-details-card">
      <TimesheetJobseekerInfoPanel layout="row" jobseeker={selectedJobseeker} />

      {showAddRow ? (
        <div className="bulk-jobseeker-add-row-footer">
          <button
            type="button"
            className="button secondary"
            onClick={() => addRow()}
          >
            <Plus size={16} />{" "}
            {t("bulkJobseekerTimesheetManagement.buttons.addRow")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
