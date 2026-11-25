import type { PaginationLabels } from "../../../components/Pagination";
import type { TimesheetPaginationMeta } from "../../../services/types/timesheet";
import type { TimesheetListT } from "./timesheetListDisplay";

/** The words of the list's two pagination bars, from the key set `bulkTimesheetManagement.pagination`. */
export function timesheetPaginationLabels(
  t: TimesheetListT,
  pagination: TimesheetPaginationMeta
): PaginationLabels {
  const p = (key: string) => t(`bulkTimesheetManagement.pagination.${key}`);
  const first = Math.min(
    (pagination.page - 1) * pagination.limit + 1,
    pagination.total
  );
  const last = Math.min(pagination.page * pagination.limit, pagination.total);
  return {
    info: `${p("showing")} ${first} ${p("to")} ${last} ${p("of")} ${pagination.total} ${p("entries")}`,
    filteredInfo:
      pagination.totalFiltered !== pagination.total
        ? `(${p("filteredFrom")} ${pagination.total} ${p("totalEntries")})`
        : undefined,
    show: p("show"),
    perPage: p("perPage"),
    pageInfo: `${p("page")} ${pagination.page} ${p("of")} ${pagination.totalPages}`,
    previous: p("previous"),
    next: p("next"),
    previousTitle: p("previousPage"),
    nextTitle: p("nextPage"),
    goToPage: p("goToPage"),
  };
}
