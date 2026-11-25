import { Building, Calendar, User } from "lucide-react";
import { CustomDropdown } from "../../../components/CustomDropdown";
import type { ClientData } from "../../../services/api/client";
import type { JobSeekerProfile } from "../../../types/jobseeker";
import { DropdownSkeleton } from "./DropdownSkeleton";
import type { BulkJsSelection, BulkJsTf } from "./bulkJobseekerTypes";

interface BulkJobseekerSelectionBarProps {
  tf: BulkJsTf;
  selectedJobseeker: BulkJsSelection["selectedJobseeker"];
  setSelectedJobseeker: BulkJsSelection["setSelectedJobseeker"];
  jobseekerLoading: BulkJsSelection["jobseekerLoading"];
  jobseekerOptions: BulkJsSelection["jobseekerOptions"];
  selectedJobseekerOption: BulkJsSelection["selectedJobseekerOption"];
  selectedClient: BulkJsSelection["selectedClient"];
  setSelectedClient: BulkJsSelection["setSelectedClient"];
  clientLoading: BulkJsSelection["clientLoading"];
  clientOptions: BulkJsSelection["clientOptions"];
  selectedClientOption: BulkJsSelection["selectedClientOption"];
  setSelectedWeekStart: BulkJsSelection["setSelectedWeekStart"];
  weekDropdownOptions: BulkJsSelection["weekDropdownOptions"];
  selectedWeekOption: BulkJsSelection["selectedWeekOption"];
}

/** The jobseeker, client and week pickers. */
export function BulkJobseekerSelectionBar({
  tf,
  selectedJobseeker,
  setSelectedJobseeker,
  jobseekerLoading,
  jobseekerOptions,
  selectedJobseekerOption,
  selectedClient,
  setSelectedClient,
  clientLoading,
  clientOptions,
  selectedClientOption,
  setSelectedWeekStart,
  weekDropdownOptions,
  selectedWeekOption,
}: BulkJobseekerSelectionBarProps) {
  return (
    <div className="timesheet-selection-bar bulk-jobseeker-selection-bar">
      <div className="selection-section">
        <label className="selection-label">
          <User size={16} />

          {tf("selection.jobSeeker")}
        </label>

        {jobseekerLoading ? (
          <DropdownSkeleton />
        ) : (
          <CustomDropdown
            options={jobseekerOptions}
            selectedOption={selectedJobseekerOption}
            onSelect={(option) => {
              if (Array.isArray(option)) return;

              setSelectedJobseeker(option.value as JobSeekerProfile);
            }}
            placeholder={tf("selection.searchJobseeker")}
            loading={false}
            icon={<User size={16} />}
            emptyMessage={tf("selection.noJobseekers")}
          />
        )}
      </div>

      <div className="selection-section">
        <label className="selection-label">
          <Building size={16} />

          {tf("selection.client")}
        </label>

        {clientLoading ? (
          <DropdownSkeleton />
        ) : (
          <CustomDropdown
            options={clientOptions}
            selectedOption={selectedClientOption}
            onSelect={(option) => {
              if (Array.isArray(option)) return;

              setSelectedClient(option.value as ClientData);
            }}
            placeholder={
              selectedJobseeker
                ? tf("selection.searchClient")
                : tf("selection.selectJobseekerFirst")
            }
            disabled={!selectedJobseeker}
            loading={false}
            icon={<Building size={16} />}
            emptyMessage={
              selectedJobseeker
                ? tf("selection.noClients")
                : tf("selection.selectJobseekerForClients")
            }
          />
        )}
      </div>

      <div className="selection-section">
        <label className="selection-label">
          <Calendar size={16} />

          {tf("selection.weekPeriod")}
        </label>

        <CustomDropdown
          options={weekDropdownOptions}
          selectedOption={selectedWeekOption}
          onSelect={(option) => {
            if (Array.isArray(option)) return;

            setSelectedWeekStart(option.value as string);
          }}
          placeholder={tf("selection.selectWeek")}
          loading={false}
          icon={<Calendar size={16} />}
          emptyMessage={tf("selection.noWeekOptions")}
          disabled={!(selectedJobseeker && selectedClient)}
          searchable={false}
        />
      </div>
    </div>
  );
}
