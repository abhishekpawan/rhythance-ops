import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePagination, type PaginationInfo } from "../hooks/usePagination";

/** The words the bar shows. The page passes them already translated; the bar adds no text of its own. */
export interface PaginationLabels {
  /** top bar: the line on the left, for example "Showing 1 to 10 of 50 entries" */
  info?: string;
  /** top bar: the filtered-from note after it, for example "(filtered from 120 total entries)"; none when absent */
  filteredInfo?: string;
  /** top bar: the page-size picker, "Show" [10] "per page" */
  show?: string;
  perPage?: string;
  /** bottom bar: the line on the left, for example "Page 2 of 5" */
  pageInfo?: string;
  /** bottom bar: the text inside the Previous and Next buttons */
  previous?: string;
  next?: string;
  /** bottom bar: the tooltip and screen-reader name of the two buttons */
  previousTitle?: string;
  nextTitle?: string;
  /** bottom bar: the screen-reader name of a page number is this text, a space and the number */
  goToPage?: string;
}

interface PaginationProps {
  /** `top` is the info line and the page-size picker, `bottom` the Previous / numbers / Next bar */
  position: "top" | "bottom";
  pagination: PaginationInfo;
  labels: PaginationLabels;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  /** the sizes in the picker (top bar); the list pages use 10, 25, 50 and 100 */
  pageSizes?: number[];
  /** the id of the picker and its label's `htmlFor` (top bar) */
  selectId?: string;
  /** an extra class on the bar, for a page that styles its own variant */
  className?: string;
  /** writes `type="button"` on the bottom bar's buttons, for a page that always had it; none by default */
  buttonType?: "button";
  /** the screen-reader name of a page number, when the page's own text holds the number (the invoice list: "Go to page 2"); default is `labels.goToPage`, a space and the number */
  pageLabel?: (page: number) => string;
}

const DEFAULT_SIZES = [10, 25, 50, 100];

/**
 * The pagination bars of the list pages (`pagination-controls`, styled by CommonTable.css). It emits exactly the
 * markup the pages used to write by hand, so a page that adopts it looks and behaves the same.
 */
export const Pagination: React.FC<PaginationProps> = ({
  position,
  pagination,
  labels,
  onPageChange,
  onLimitChange,
  pageSizes = DEFAULT_SIZES,
  selectId = "pageSize",
  className,
  buttonType,
  pageLabel,
}) => {
  const { showBottomBar, pageNumbers } = usePagination(pagination);
  const classes = (base: string) => (className ? `${base} ${className}` : base);

  if (position === "top") {
    return (
      <div className={classes("pagination-controls top")}>
        <div className="pagination-info">
          <span className="pagination-text">
            {labels.info}
            {labels.filteredInfo && (
              <span className="filtered-info"> {labels.filteredInfo}</span>
            )}
          </span>
        </div>
        <div className="pagination-size-selector">
          <label htmlFor={selectId} className="page-size-label">
            {labels.show}
          </label>
          <select
            id={selectId}
            value={pagination.limit}
            onChange={(e) => onLimitChange?.(parseInt(e.target.value))}
            className="page-size-select"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="page-size-label">{labels.perPage}</span>
        </div>
      </div>
    );
  }

  if (!showBottomBar) return null;

  return (
    <div className={classes("pagination-controls bottom")}>
      <div className="pagination-info">
        <span className="pagination-text">{labels.pageInfo}</span>
      </div>
      <div className="pagination-buttons">
        <button
          type={buttonType}
          className="pagination-btn prev"
          onClick={() => onPageChange?.(pagination.page - 1)}
          disabled={!pagination.hasPrevPage}
          title={labels.previousTitle}
          aria-label={labels.previousTitle}
        >
          <ChevronLeft size={16} />
          <span>{labels.previous}</span>
        </button>

        <div className="page-numbers">
          {pageNumbers.map((pageNum) => (
            <button
              type={buttonType}
              key={pageNum}
              className={`page-number-btn ${
                pageNum === pagination.page ? "active" : ""
              }`}
              onClick={() => onPageChange?.(pageNum)}
              aria-label={
                pageLabel ? pageLabel(pageNum) : `${labels.goToPage} ${pageNum}`
              }
            >
              {pageNum}
            </button>
          ))}
        </div>

        <button
          type={buttonType}
          className="pagination-btn next"
          onClick={() => onPageChange?.(pagination.page + 1)}
          disabled={!pagination.hasNextPage}
          title={labels.nextTitle}
          aria-label={labels.nextTitle}
        >
          <span>{labels.next}</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
