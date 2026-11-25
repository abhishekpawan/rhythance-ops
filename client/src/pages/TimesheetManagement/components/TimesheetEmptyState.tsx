import { Building, FileText } from "lucide-react";
import { EmptyState } from "../../../components/EmptyState";
import { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";

type TimesheetEmptyVariant = "clients" | "positions";

interface TimesheetEmptyStateProps {
  variant: TimesheetEmptyVariant;
}

export function TimesheetEmptyState({ variant }: TimesheetEmptyStateProps) {
  const tf = useTimesheetFormTranslation();

  if (variant === "clients") {
    return (
      <div className="timesheet-card empty-state-card">
        <EmptyState
          className="timesheet-empty-state"
          icon={<Building size={48} />}
          title={tf("empty.noClientsTitle")}
          description={tf("empty.noClientsBody")}
        />
      </div>
    );
  }

  return (
    <div className="timesheet-card empty-state-card">
      <EmptyState
        className="timesheet-empty-state"
        icon={<FileText size={48} />}
        title={tf("empty.noPositionsTitle")}
        description={tf("empty.noPositionsBody")}
      />
    </div>
  );
}
