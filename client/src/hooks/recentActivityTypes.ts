/** Shapes used by the recent-activity feed hook. */

// Type definitions for recent activities
export interface RecentActivity {
  id: string;
  created_at: string;
  actor_id: string;
  actor_name: string;
  actor_type: string;
  action_type:
    | "delete_jobseeker"
    | "create_client"
    | "create_timesheet"
    | "update_client"
    | "assign_jobseeker"
    | "reject_jobseeker"
    | "create_position"
    | "delete_position"
    | "pending_jobseeker"
    | "update_timesheet"
    | "delete_invoice"
    | "delete_timesheet"
    | "verify_jobseeker"
    | "update_invoice"
    | "update_jobseeker"
    | "delete_client"
    | "remove_jobseeker"
    | "create_invoice"
    | "update_position"
    | "create_jobseeker"
    | "user_registration"
    | "create_client_draft"
    | "update_client_draft"
    | "delete_client_draft"
    | "create_position_draft"
    | "update_position_draft"
    | "delete_position_draft"
    | "create_bulk_timesheet"
    | "update_bulk_timesheet"
    | "delete_bulk_timesheet"
    | "send_bulk_timesheet_email"
    | "send_invoice_email"
    // User management actions
    | "update_user_manager"
    | "update_user_roles"
    // Consent management actions
    | "create_consent_request"
    | "user_consent_given"
    | "update_feature_flag"
    | "update_portal_settings"
    | "resend_consent_request";
  action_verb: string;
  primary_entity_type: string;
  primary_entity_id?: string;
  primary_entity_name?: string;
  secondary_entity_type?: string;
  secondary_entity_id?: string;
  secondary_entity_name?: string;
  tertiary_entity_type?: string;
  tertiary_entity_id?: string;
  tertiary_entity_name?: string;
  status?: string;
  metadata: Record<string, unknown>;
  display_message: string;
  category:
    | "position_management"
    | "client_management"
    | "financial"
    | "system"
    | "candidate_management"
    | "user_management";
  priority: "low" | "normal" | "high" | "urgent";
  is_deleted: boolean;
}

export interface UseRecentActivitiesOptions {
  limit?: number;
  category?: string;
  actorId?: string;
  enabled?: boolean;
}

export interface UseRecentActivitiesReturn {
  activities: RecentActivity[];
  isConnected: boolean;
  error: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  retry: () => void;
  loadMore: () => void;
}
