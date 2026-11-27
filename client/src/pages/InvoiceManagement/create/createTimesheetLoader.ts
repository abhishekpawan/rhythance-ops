import { getTimesheetsByClientAndDateRange } from "../../../services/api/invoice";
import { buildTimesheetLineItems } from "../timesheetLineItems";
import { PositionData } from "../../../services/api/position";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";

export function createTimesheetLoader(
  ctx: ReturnType<typeof useInvoiceFormState> &
    ReturnType<typeof useInvoicePageHooks>
) {
  const {
    positions,
    selectedClient,
    setIsFetchingTimesheets,
    setLineItems,
    setPositions,
    setTimesheetFetchMessage,
    t,
    timesheetEndDate,
    timesheetStartDate,
  } = ctx;
  // Fetch and populate timesheets for the selected date range
  const fetchAndPopulateTimesheets = async () => {
    if (!selectedClient?.id) {
      setTimesheetFetchMessage(t("invoiceManagement.selectClientFirst"));
      return;
    }

    if (!timesheetStartDate || !timesheetEndDate) {
      setTimesheetFetchMessage(t("invoiceManagement.selectDateRange"));
      return;
    }

    setIsFetchingTimesheets(true);
    setTimesheetFetchMessage("");

    try {
      const response = await getTimesheetsByClientAndDateRange(
        selectedClient.id,
        timesheetStartDate,
        timesheetEndDate
      );

      if (
        !response.success ||
        !response.timesheets ||
        response.timesheets.length === 0
      ) {
        setTimesheetFetchMessage(t("invoiceManagement.noTimesheetsFound"));
        setIsFetchingTimesheets(false);
        return;
      }

      const newLineItems = buildTimesheetLineItems(
        response.timesheets,
        positions
      );

      // Update positions state with unique positions from timesheets
      const uniquePositions: PositionData[] = Array.from(
        new Set(response.timesheets.map((t) => t.position.id))
      )
        .map((positionId) => {
          const timesheet = response.timesheets.find(
            (t) => t.position.id === positionId
          );
          if (!timesheet) return null;
          return {
            id: timesheet.position.id,
            positionCode: timesheet.position.positionCode,
            positionNumber: timesheet.position.positionNumber,
            title: timesheet.position.title,
            regularPayRate: timesheet.regularPayRate.toString(),
            premiumPayRate: (timesheet.premiumPayRate || 0).toString(),
            billRate: timesheet.regularBillRate.toString(),
            markup: "0",
          } as PositionData;
        })
        .filter((p): p is PositionData => p !== null);

      // Fetch full position details including overtime for unique positions
      const positionsWithOvertime: PositionData[] = [];
      for (const positionId of Array.from(
        new Set(response.timesheets.map((t) => t.position.id))
      )) {
        const existingPosition = positions.find((p) => p.id === positionId);
        if (existingPosition) {
          positionsWithOvertime.push(existingPosition);
        } else {
          // Try to get position details with overtime info
          const fullPosition = uniquePositions.find((p) => p.id === positionId);
          if (fullPosition) {
            positionsWithOvertime.push(fullPosition);
          }
        }
      }

      // Update positions if not already present
      setPositions((prevPositions) => {
        const existingIds = new Set(prevPositions.map((p) => p.id));
        const newPositions = positionsWithOvertime.filter(
          (p) => p && !existingIds.has(p.id)
        );
        return [...prevPositions, ...newPositions];
      });

      // Jobseekers are now fetched globally, no need to populate from timesheets

      // Replace existing line items with new ones
      setLineItems(newLineItems);

      setTimesheetFetchMessage(
        `${t("invoiceManagement.timesheetsLoaded")}: ${newLineItems.length} ${t(
          "invoiceManagement.lineItems"
        )}`
      );
    } catch (error) {
      console.error("Error fetching timesheets:", error);
      setTimesheetFetchMessage(
        error instanceof Error
          ? error.message
          : t("invoiceManagement.fetchTimesheetsFailed")
      );
    } finally {
      setIsFetchingTimesheets(false);
    }
  };

  return { fetchAndPopulateTimesheets };
}
