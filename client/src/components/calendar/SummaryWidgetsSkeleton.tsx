/** What the summary shows while its numbers are on the way. */
export function SummaryWidgetsSkeleton() {
  return (
    <div className="summary-widgets">
      <div className="summary-header">
        <div className="header-left">
          <div className="summary-title-skeleton"></div>
          <div className="summary-date-skeleton"></div>
        </div>
        <div className="header-right">
          <div className="filter-skeleton"></div>
        </div>
      </div>
      <div className="widgets-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="widget-skeleton">
            <div className="widget-icon-skeleton"></div>
            <div className="widget-content-skeleton">
              <div className="widget-label-skeleton"></div>
              <div className="widget-value-skeleton"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
