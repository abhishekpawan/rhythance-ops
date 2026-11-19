import { useLanguage } from "../../contexts/language/language-provider";
import { ClientData } from "../../services/api/client";
import {
  CustomDropdown,
  DropdownOption,
} from "../../components/CustomDropdown";
import { Calendar, User, Building } from "lucide-react";
import { JobSeekerProfile } from "../../types/jobseeker";

type Props = {
  jobseekerLoading: boolean;
  jobseekerOptions: DropdownOption[];
  selectedJobseekers: JobSeekerProfile[];
  setSelectedJobseekers: (value: JobSeekerProfile[]) => void;
  clientLoading: boolean;
  clientOptions: DropdownOption[];
  selectedClients: ClientData[];
  setSelectedClients: (value: ClientData[]) => void;
  weekDropdownOptions: DropdownOption[];
  selectedWeeks: Array<{ start: string; end: string }>;
  setSelectedWeeks: (value: Array<{ start: string; end: string }>) => void;
  payCycleOptions: DropdownOption[];
  selectedPayCycles: string[];
  setSelectedPayCycles: (value: string[]) => void;
  listNameOptions: DropdownOption[];
  selectedListNames: string[];
  setSelectedListNames: (value: string[]) => void;
};

export function WeeklyTimesheetFilters({
  jobseekerLoading,
  jobseekerOptions,
  selectedJobseekers,
  setSelectedJobseekers,
  clientLoading,
  clientOptions,
  selectedClients,
  setSelectedClients,
  weekDropdownOptions,
  selectedWeeks,
  setSelectedWeeks,
  payCycleOptions,
  selectedPayCycles,
  setSelectedPayCycles,
  listNameOptions,
  selectedListNames,
  setSelectedListNames,
}: Props) {
  const { t } = useLanguage();
  return (
    <div className="timesheet-selection-bar">
      <div className="selection-row">
        <div className="selection-section">
          <label className="selection-label">
            {t("reports.filters.jobSeeker")}
          </label>
          {jobseekerLoading ? (
            <div className="invoice-dropdown-skeleton">
              <div className="skeleton-dropdown-trigger">
                <div className="skeleton-icon"></div>
                <div className="skeleton-text skeleton-dropdown-text"></div>
                <div className="skeleton-icon skeleton-chevron"></div>
              </div>
            </div>
          ) : (
            <CustomDropdown
              options={jobseekerOptions}
              selectedOptions={
                selectedJobseekers.length > 0
                  ? selectedJobseekers
                      .map(
                        (j) =>
                          jobseekerOptions.find(
                            (o) => o.id === j.id
                          ) as DropdownOption
                      )
                      .filter(Boolean)
                  : []
              }
              onSelect={(opts) => {
                if (Array.isArray(opts))
                  setSelectedJobseekers(
                    opts.map((o) => o.value as JobSeekerProfile)
                  );
                else if (opts && typeof opts === "object")
                  setSelectedJobseekers([opts.value as JobSeekerProfile]);
                else setSelectedJobseekers([]);
              }}
              placeholder={t("reports.placeholders.selectJobSeeker")}
              multiSelect={true}
              showSelectAll={true}
              icon={<User size={16} />}
              emptyMessage={t("reports.emptyMessages.noJobSeekers")}
              maxVisibleTagsOverride={2}
            />
          )}
        </div>
        <div className="selection-section">
          <label className="selection-label">
            {t("reports.filters.clients")}
          </label>
          {clientLoading ? (
            <div className="invoice-dropdown-skeleton">
              <div className="skeleton-dropdown-trigger">
                <div className="skeleton-icon"></div>
                <div className="skeleton-text skeleton-dropdown-text"></div>
                <div className="skeleton-icon skeleton-chevron"></div>
              </div>
            </div>
          ) : (
            <CustomDropdown
              options={clientOptions}
              selectedOptions={
                selectedClients.length > 0
                  ? selectedClients
                      .map(
                        (c) =>
                          clientOptions.find(
                            (o) => o.id === c.id
                          ) as DropdownOption
                      )
                      .filter(Boolean)
                  : []
              }
              onSelect={(opts) => {
                if (Array.isArray(opts))
                  setSelectedClients(opts.map((o) => o.value as ClientData));
                else if (opts && typeof opts === "object")
                  setSelectedClients([opts.value as ClientData]);
                else setSelectedClients([]);
              }}
              placeholder={t("reports.placeholders.selectClients")}
              multiSelect={true}
              showSelectAll={true}
              icon={<Building size={16} />}
              emptyMessage={t("reports.emptyMessages.noClients")}
              maxVisibleTagsOverride={5}
            />
          )}
        </div>
      </div>
      <div className="selection-row">
        <div className="selection-section">
          <label className="selection-label">
            {t("reports.filters.weekPeriods")}
          </label>
          <CustomDropdown
            options={weekDropdownOptions}
            selectedOptions={
              selectedWeeks.length > 0
                ? selectedWeeks
                    .map(
                      (w) =>
                        weekDropdownOptions.find(
                          (o) => o.id === w.start + "_" + w.end
                        ) as DropdownOption
                    )
                    .filter(Boolean)
                : []
            }
            onSelect={(opts) => {
              if (Array.isArray(opts))
                setSelectedWeeks(
                  opts.map((o) => o.value as { start: string; end: string })
                );
              else if (opts && typeof opts === "object")
                setSelectedWeeks([
                  opts.value as { start: string; end: string },
                ]);
              else setSelectedWeeks([]);
            }}
            placeholder={t("reports.placeholders.selectWeekPeriods")}
            multiSelect={true}
            searchable={false}
            showSelectAll={true}
            icon={<Calendar size={16} />}
            maxVisibleTagsOverride={2}
          />
        </div>
        <div className="selection-section">
          <label className="selection-label">
            {t("reports.filters.payCycle")}
          </label>
          <CustomDropdown
            options={payCycleOptions}
            searchable={false}
            selectedOptions={
              selectedPayCycles.length > 0
                ? selectedPayCycles
                    .map(
                      (pc) =>
                        payCycleOptions.find(
                          (o) => o.value === pc
                        ) as DropdownOption
                    )
                    .filter(Boolean)
                : []
            }
            onSelect={(opts) => {
              if (Array.isArray(opts))
                setSelectedPayCycles(opts.map((o) => o.value as string));
              else if (opts && typeof opts === "object")
                setSelectedPayCycles([opts.value as string]);
              else setSelectedPayCycles([]);
            }}
            placeholder={t("reports.placeholders.selectPayCycle")}
            multiSelect={true}
            showSelectAll={true}
            maxVisibleTagsOverride={2}
          />
        </div>
        <div className="selection-section">
          <label className="selection-label">
            {t("reports.filters.listName")}
          </label>
          <CustomDropdown
            options={listNameOptions}
            searchable={false}
            selectedOptions={
              selectedListNames.length > 0
                ? selectedListNames
                    .map(
                      (ln) =>
                        listNameOptions.find(
                          (o) => o.value === ln
                        ) as DropdownOption
                    )
                    .filter(Boolean)
                : []
            }
            onSelect={(opts) => {
              if (Array.isArray(opts))
                setSelectedListNames(opts.map((o) => o.value as string));
              else if (opts && typeof opts === "object")
                setSelectedListNames([opts.value as string]);
              else setSelectedListNames([]);
            }}
            placeholder={t("reports.placeholders.selectListName")}
            multiSelect={true}
            showSelectAll={true}
            maxVisibleTagsOverride={2}
          />
        </div>
      </div>
    </div>
  );
}
