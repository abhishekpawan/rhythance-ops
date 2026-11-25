import type { DropdownOption } from "../../../components/CustomDropdown";
import type { ClientPosition } from "../types";
import { BulkJobseekerPositionCard } from "./BulkJobseekerPositionCard";
import type {
  BulkJsForms,
  BulkJsRows,
  BulkJsT,
  BulkJsTf,
} from "./bulkJobseekerTypes";

interface BulkJobseekerPositionRowsProps {
  t: BulkJsT;
  tf: BulkJsTf;
  rows: BulkJsRows;
  positionLoading: boolean;
  positionDropdownOptionsForRow: (rowId: string) => DropdownOption[];
  payrollCtxForRow: BulkJsForms["payrollCtxForRow"];
  setRowPosition: BulkJsForms["setRowPosition"];
  removeRow: BulkJsForms["removeRow"];
  updateRowEntry: BulkJsForms["updateRowEntry"];
  updateRowBonus: BulkJsForms["updateRowBonus"];
  updateRowDeduction: BulkJsForms["updateRowDeduction"];
  updateRowNotes: BulkJsForms["updateRowNotes"];
  updateRowEmailSent: BulkJsForms["updateRowEmailSent"];
}

/** One card per position row. */
export function BulkJobseekerPositionRows({
  t,
  tf,
  rows,
  positionLoading,
  positionDropdownOptionsForRow,
  payrollCtxForRow,
  setRowPosition,
  removeRow,
  updateRowEntry,
  updateRowBonus,
  updateRowDeduction,
  updateRowNotes,
  updateRowEmailSent,
}: BulkJobseekerPositionRowsProps) {
  return (
    <>
      {rows.map((row) => {
        const options = positionDropdownOptionsForRow(row.rowId);

        const selectedOpt = row.position?.id
          ? options.find((o) => o.id === row.position!.id)
          : undefined;

        const emptyOptions = options.length === 0;

        return (
          <BulkJobseekerPositionCard
            key={row.rowId}
            row={row}
            positionOptions={options}
            selectedPositionOption={selectedOpt ?? undefined}
            onPositionSelect={(option) => {
              if (Array.isArray(option)) return;

              setRowPosition(row.rowId, option.value as ClientPosition);
            }}
            positionLoading={positionLoading}
            payrollCtx={payrollCtxForRow(row)}
            formLoading={!!row.formLoading}
            tf={tf}
            t={t}
            labels={{
              removePositionTooltip: t(
                "bulkJobseekerTimesheetManagement.buttons.removePosition"
              ),

              positionLabel: t("bulkTimesheetManagement.columns.position"),

              selectPositionHint: emptyOptions
                ? t(
                    "bulkJobseekerTimesheetManagement.placeholders.noPositionsLeft"
                  )
                : t(
                    "bulkJobseekerTimesheetManagement.placeholders.selectPositionDraft"
                  ),

              buildingForm: t(
                "bulkJobseekerTimesheetManagement.messages.buildingDraft"
              ),
            }}
            removeDisabled={rows.length <= 1}
            onRemove={removeRow}
            updateEntry={updateRowEntry}
            updateBonus={updateRowBonus}
            updateDeduction={updateRowDeduction}
            updateNotes={updateRowNotes}
            updateEmailSent={updateRowEmailSent}
          />
        );
      })}
    </>
  );
}
