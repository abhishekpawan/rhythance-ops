import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "../../contexts/language/language-provider";

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface SupportPaginationProps {
  pagination: PaginationInfo;
  onPrevious: () => void;
  onNext: () => void;
  onPage: (page: number) => void;
}

export const SupportPagination: React.FC<SupportPaginationProps> = ({
  pagination,
  onPrevious,
  onNext,
  onPage,
}) => {
  const { t } = useLanguage();

  if (!(pagination.totalPages > 1)) return null;

  return (
    <div className="pagination-controls bottom">
      <div className="pagination-info">
        <span className="pagination-text">
          {t("support.paginationPage")
            .replace("{page}", String(pagination.page))
            .replace("{totalPages}", String(pagination.totalPages))}
        </span>
      </div>
      <div className="pagination-buttons">
        <button
          className="pagination-btn prev"
          onClick={onPrevious}
          disabled={!pagination.hasPrevPage}
          title={t("support.paginationPrevious")}
          aria-label={t("support.paginationPrevious")}
        >
          <ChevronLeft size={16} />
          <span>{t("support.paginationPrevious")}</span>
        </button>

        <div className="page-numbers">
          {Array.from(
            { length: Math.min(5, pagination.totalPages) },
            (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  className={`page-number-btn ${
                    pageNum === pagination.page ? "active" : ""
                  }`}
                  onClick={() => onPage(pageNum)}
                  aria-label={`Go to page ${pageNum}`}
                >
                  {pageNum}
                </button>
              );
            }
          )}
        </div>

        <button
          className="pagination-btn next"
          onClick={onNext}
          disabled={!pagination.hasNextPage}
          title={t("support.paginationNext")}
          aria-label={t("support.paginationNext")}
        >
          <span>{t("support.paginationNext")}</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
