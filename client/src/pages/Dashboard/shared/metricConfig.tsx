/**
 * Card colours/icons and the response shapes shared by the admin and
 * recruiter dashboards. The mapping itself is in metricTransforms.ts.
 */
import {
  Users,
  CheckCircle,
  RotateCcw,
  X,
  Building2,
  Briefcase,
  Target,
  CheckSquare,
  Brain,
  FileText,
} from "lucide-react";
import { MetricData } from "../../../components/dashboard/types";

export const CACHE_DURATION = 30000; // 30 seconds

export const METRIC_CONFIGS = {
  recruiter: {
    total_profiles: { color: "#3B82F6", icon: <Users size={20} /> },
    pending_profiles: { color: "#F59E0B", icon: <RotateCcw size={20} /> },
    verified_profiles: { color: "#10B981", icon: <CheckCircle size={20} /> },
    rejected_profiles: { color: "#EF4444", icon: <X size={20} /> },
  },
  client: {
    total_clients: { color: "#8B5CF6", icon: <Building2 size={20} /> },
  },
  position: {
    total_positions_added: { color: "#6366F1", icon: <Briefcase size={20} /> },
    total_position_slots: { color: "#F59E0B", icon: <Target size={20} /> },
    total_positions_filled: {
      color: "#10B981",
      icon: <CheckSquare size={20} />,
    },
  },
  ai: {
    documents_scanned: { color: "#8B5CF6", icon: <FileText size={20} /> },
    jobseekers_matched: { color: "#06B6D4", icon: <Brain size={20} /> },
  },
} as const;

export type MetricsType = "metrics" | "clients" | "positions" | "aiInsights";

export interface MetricsState {
  data: MetricData[];
  loading: boolean;
  error: string | null;
}

export interface MetricResponse {
  id: string;
  label: string;
  currentValue: number;
  currentPeriodValue?: number;
  dailyData?: Array<{ date: string; value: number; previousValue: number }>;
  previousValue: number;
  unit: string;
  formatType: string;
  description: string;
  historicalData: Array<{
    period: string;
    value: number;
    date: string | Date;
  }>;
  redirectTo?: string;
}

export interface APIResponse {
  metrics: MetricResponse[];
  timeRange?: {
    months: number;
    startDate: string;
    endDate: string;
  };
  scope?: string;
}
