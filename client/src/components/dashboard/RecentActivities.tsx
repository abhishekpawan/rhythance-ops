import React from "react";
import {
  Clock,
  XCircle,
  RefreshCw,
  ChevronDown,
  Loader2,
} from "lucide-react";
import "./RecentActivities.css";
import "./RecentActivities.entities.css";
import "./RecentActivities.skeleton.css";
import type { RecentActivitiesProps } from "./recentActivities/types";
import { getActivityIcon, getStatusIcon } from "./recentActivities/activityIcons";
import {
  formatActivityMessage,
  formatTimeAgo,
} from "./recentActivities/formatActivityMessage";
import { ActivitySkeleton } from "./recentActivities/ActivitySkeleton";

export const RecentActivities: React.FC<RecentActivitiesProps> = ({
  activities,
  isConnected,
  error,
  isLoading = false,
  isLoadingMore = false,
  hasMore = false,
  onRetry,
  onLoadMore,
}) => {
  if (error) {
    return (
      <div className="recent-activities-card">
        <div className="activities-header">
          <h3 className="activities-title">Recent Activities</h3>
          <div className="connection-status error">
            <XCircle size={14} />
            <span>Connection Error</span>
          </div>
        </div>
        <div className="activities-error">
          <p>{error}</p>
          {onRetry && (
            <button
              className="retry-button"
              onClick={onRetry}
              aria-label="Retry loading activities"
            >
              <RefreshCw size={16} />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render loading skeleton
  if (isLoading) {
    return (
      <div className="recent-activities-card">
        <div className="activities-header">
          <h3 className="activities-title">Recent Activities</h3>
          <div className="connection-status connecting">
            <div className="status-indicator" />
            <span>Loading...</span>
          </div>
        </div>

        <div className="activities-content">
          <div className="activities-list">
            {[1, 2, 3, 4, 5].map((index) => (
              <ActivitySkeleton key={index} index={index} />
            ))}
          </div>
        </div>

        <div className="activities-footer">
          <div
            className="skeleton-text"
            style={{ width: "120px", height: "12px" }}
          ></div>
        </div>
      </div>
    );
  }

  return (
    <div className="recent-activities-card">
      <div className="activities-header">
        <h3 className="activities-title">Recent Activities</h3>
        <div
          className={`connection-status ${
            isConnected ? "connected" : "disconnected"
          }`}
        >
          <div className="status-indicator" />
          <span>{isConnected ? "Live" : "Connecting..."}</span>
        </div>
      </div>

      <div className="activities-content">
        {activities.length === 0 ? (
          <div className="activities-empty">
            <Clock size={24} className="empty-icon" />
            <p>No recent activities</p>
            <span>Activities will appear here in real-time</span>
          </div>
        ) : (
          <div className="activities-list">
            {activities.map((activity) => (
              <div key={activity.id} className="activity-item">
                <div className="activity-icon">
                  {getActivityIcon(activity.action_type, activity.category)}
                </div>

                <div className="activity-content">
                  <div className="activity-main">
                    <div className="activity-message">
                      {formatActivityMessage(activity)}
                    </div>
                    <div className="activity-meta">
                      <span className="activity-time">
                        {formatTimeAgo(activity.created_at)}
                      </span>
                      <div className="activity-status">
                        {getStatusIcon(activity.action_type)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="activity-category">
                  <span
                    className={`category-badge category-${activity.category.replace(
                      "_",
                      "-"
                    )}`}
                  >
                    {activity.category === "candidate_management"
                      ? "Jobseeker Management"
                      : activity.category.replace("_", " ")}
                  </span>
                </div>
              </div>
            ))}

            {/* Loading More Skeleton */}
            {isLoadingMore && (
              <>
                {[1, 2, 3, 4, 5].map((index) => (
                  <ActivitySkeleton
                    key={index}
                    index={index}
                    keyPrefix="loading-more-"
                  />
                ))}
              </>
            )}

            {/* Load More Button */}
            {hasMore && onLoadMore && (
              <div className="load-more-container">
                <button
                  className={`load-more-button ${
                    isLoadingMore ? "loading" : ""
                  }`}
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  aria-label="Load more activities"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 size={16} className="loading-spinner" />
                      <span>Loading more...</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={16} />
                      <span>Load 20 more activities</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {activities.length > 0 && (
        <div className="activities-footer">
          <span className="activities-count">
            {activities.length} recent activity
            {activities.length === 1 ? "y" : "ies"}
            {!hasMore && activities.length > 10 && (
              <span className="all-loaded"> • All activities loaded</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
};
