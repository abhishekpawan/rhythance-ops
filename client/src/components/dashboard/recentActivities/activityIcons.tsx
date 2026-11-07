/** Icons for each activity category and action. */
import {
  Clock,
  User,
  UserPlus,
  UserMinus,
  Briefcase,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Building2,
  Target,
  RefreshCw,
  PlusCircleIcon,
  Trash,
  Pencil,
  Mail,
  FileCheck,
  Send,
} from "lucide-react";

export const getActivityIcon = (actionType: string, category: string) => {
  switch (category) {
    case "candidate_management":
      if (actionType.includes("add") || actionType.includes("create")) {
        return <UserPlus size={16} />;
      } else if (
        actionType.includes("remove") ||
        actionType.includes("delete")
      ) {
        return <UserMinus size={16} />;
      }
      return <User size={16} />;
    case "position_management":
      return <Briefcase size={16} />;
    case "client_management":
      return <Building2 size={16} />;
    case "document_processing":
      return <FileText size={16} />;
    case "matching":
      return <Target size={16} />;
    case "financial":
      return <FileText size={16} />;
    case "user_management":
      if (actionType.includes("consent")) {
        return <FileCheck size={16} />;
      }
      return <User size={16} />;
    case "send_bulk_timesheet_email":
      return <Mail size={16} />;
    case "send_invoice_email":
      return <Mail size={16} />;
    case "consent_management":
      return <FileCheck size={16} />;
    default:
      return <AlertCircle size={16} />;
  }
};

export const getStatusIcon = (actionType: string) => {
  switch (actionType) {
    case "create_position":
    case "create_jobseeker":
    case "assign_jobseeker":
    case "create_client":
    case "create_client_draft":
    case "create_position_draft":
      return <PlusCircleIcon size={12} className="status-success" />;
    case "update_position":
    case "update_jobseeker":
    case "update_client":
    case "update_client_draft":
    case "update_position_draft":
      return <Pencil size={12} className="status-success" />;
    case "remove_jobseeker":
    case "delete_position":
    case "delete_jobseeker":
    case "delete_client":
    case "delete_client_draft":
    case "delete_position_draft":
      return <Trash size={12} className="status-error" />;
    case "create_invoice":
      return <PlusCircleIcon size={12} className="status-success" />;
    case "update_invoice":
      return <Pencil size={12} className="status-success" />;
    case "update_user_manager":
    case "update_user_roles":
      return <Pencil size={12} className="status-success" />;
    case "complete_onboarding":
      return <CheckCircle size={12} className="status-success" />;
    case "invite_recruiter":
    case "resend_invitation":
      return <UserPlus size={12} className="status-success" />;
    case "delete_invoice":
      return <Trash size={12} className="status-error" />;
    case "create_timesheet":
    case "create_bulk_timesheet":
      return <PlusCircleIcon size={12} className="status-success" />;
    case "update_timesheet":
    case "update_bulk_timesheet":
      return <Pencil size={12} className="status-success" />;
    case "delete_timesheet":
    case "delete_bulk_timesheet":
      return <Trash size={12} className="status-error" />;
    case "verify_jobseeker":
      return <CheckCircle size={12} className="status-success" />;
    case "reject_jobseeker":
      return <XCircle size={12} className="status-error" />;
    case "pending_jobseeker":
      return <Clock size={12} className="status-pending" />;
    case "send_invoice_email":
      return <Mail size={12} className="status-success" />;
    case "create_consent_request":
      return <PlusCircleIcon size={12} className="status-success" />;
    case "user_consent_given":
      return <CheckCircle size={12} className="status-success" />;
    case "resend_consent_request":
      return <Send size={12} className="status-success" />;
    case "update_feature_flag":
    case "update_portal_settings":
      return <RefreshCw size={12} className="status-success" />;

    default:
      return <AlertCircle size={12} className="status-info" />;
  }
};
