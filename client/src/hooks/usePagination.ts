import { useMemo } from "react";

/** What the list endpoints answer with (and what `<Pagination>` reads). */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * The page numbers shown between "Previous" and "Next": at most five, the current page in the middle
 * (or the first or last five when it is near an end).
 */
export function pageWindow(page: number, totalPages: number): number[] {
  return Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
    if (totalPages <= 5) return i + 1;
    if (page <= 3) return i + 1;
    if (page >= totalPages - 2) return totalPages - 4 + i;
    return page - 2 + i;
  });
}

/** The numbers `<Pagination>` shows, for one answer of a list endpoint. */
export function usePagination(pagination: PaginationInfo) {
  const { page, totalPages } = pagination;
  return useMemo(
    () => ({
      /** the bottom bar is shown only when there is more than one page */
      showBottomBar: totalPages > 1,
      pageNumbers: pageWindow(page, totalPages),
    }),
    [page, totalPages]
  );
}
