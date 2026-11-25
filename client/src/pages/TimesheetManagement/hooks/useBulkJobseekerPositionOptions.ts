import { useCallback, useMemo } from "react";
import type { DropdownOption } from "../../../components/CustomDropdown";
import { getPositionDisplayTitle } from "../../../utils/positionDisplay";
import type { ClientPosition } from "../types";
import type { BulkJsRows, BulkJsT } from "../components/bulkJobseekerTypes";

export function useBulkJobseekerPositionOptions(
  t: BulkJsT,
  rows: BulkJsRows,
  assignablePositions: ClientPosition[]
) {
  const unknownPositionFallback = useMemo(
    () => t("bulkTimesheetManagement.constants.unknownPosition"),

    [t]
  );

  const positionDropdownOptionsForRow = useCallback(
    (rowId: string): DropdownOption[] => {
      const row = rows.find((r) => r.rowId === rowId);

      const currentPid = row?.position?.id;

      const taken = new Set(
        rows

          .filter((r) => r.rowId !== rowId && r.position?.id)

          .map((r) => r.position!.id)
      );

      return assignablePositions

        .filter((p) => p.id && (!taken.has(p.id) || p.id === currentPid))

        .map((position) => {
          const rate = (
            Number.parseFloat(position.regularPayRate || "0") || 0
          ).toFixed(2);

          const subcatNote = position.isSubcategory
            ? ` • ${t("bulkJobseekerTimesheetManagement.dropdown.subcategoryBadge")}`
            : "";

          return {
            id: position.id || "",

            label: `${getPositionDisplayTitle(position, unknownPositionFallback)} — ${position.positionNumber ?? ""}`,

            sublabel: `${position.positionCode} • $${rate}/h${subcatNote}`,

            value: position,
          };
        });
    },

    [rows, assignablePositions, t, unknownPositionFallback]
  );

  return { unknownPositionFallback, positionDropdownOptionsForRow };
}
