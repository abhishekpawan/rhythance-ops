/** What the day panel shows while the month's events are on the way. */
export function DayViewSkeleton() {
  return (
    <div className="day-view-panel day-view-skeleton-loading">
      <div className="day-view-header">
        <div className="skeleton-icon"></div>
        <div className="skeleton-title"></div>
      </div>

      <div className="skeleton-selected-date">
        <div className="skeleton-date-title"></div>
        <div className="skeleton-event-count"></div>
      </div>

      <div className="skeleton-events">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-event-item">
            <div className="skeleton-event-header">
              <div className="skeleton-event-type">
                <div className="skeleton-event-icon"></div>
                <div className="skeleton-event-label"></div>
              </div>
              <div className="skeleton-event-duration">
                <div className="skeleton-duration-icon"></div>
                <div className="skeleton-duration-text"></div>
              </div>
            </div>
            <div className="skeleton-event-content">
              <div className="skeleton-event-title"></div>
              <div className="skeleton-event-detail">
                <div className="skeleton-detail-icon"></div>
                <div className="skeleton-detail-text"></div>
              </div>
              <div className="skeleton-event-detail">
                <div className="skeleton-detail-icon"></div>
                <div className="skeleton-detail-text"></div>
              </div>
            </div>
            <div className="skeleton-event-actions">
              <div className="skeleton-action-button"></div>
            </div>
          </div>
        ))}
      </div>

      <div className="skeleton-summary">
        <div className="skeleton-summary-title"></div>
        <div className="skeleton-summary-stats">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-stat-item">
              <div className="skeleton-stat-label"></div>
              <div className="skeleton-stat-value"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
