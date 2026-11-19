import { useLanguage } from "../../contexts/language/language-provider";
import { ClientData } from "../../services/api/client";
import {
  CustomDropdown,
  DropdownOption,
} from "../../components/CustomDropdown";
import { Calendar, User, Building, Users } from "lucide-react";
import { JobSeekerProfile } from "../../types/jobseeker";

type Props = {
  clientLoading: boolean;
  clientOptions: DropdownOption[];
  selectedClients: ClientData[];
  setSelectedClients: (value: ClientData[]) => void;
  jobseekerLoading: boolean;
  jobseekerOptions: DropdownOption[];
  selectedJobseekers: JobSeekerProfile[];
  setSelectedJobseekers: (value: JobSeekerProfile[]) => void;
  salesPersonDropdownOptions: DropdownOption[];
  selectedSalesPersons: string[];
  setSelectedSalesPersons: (value: string[]) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
};

export function SalesReportFilters({
  clientLoading,
  clientOptions,
  selectedClients,
  setSelectedClients,
  jobseekerLoading,
  jobseekerOptions,
  selectedJobseekers,
  setSelectedJobseekers,
  salesPersonDropdownOptions,
  selectedSalesPersons,
  setSelectedSalesPersons,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: Props) {
  const { t } = useLanguage();
  return (
    <div className="timesheet-selection-bar">
      <div className="selection-row">
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
              maxVisibleTagsOverride={4}
            />
          )}
          <div style={{ marginTop: 8, color: "#555", fontSize: 13 }}>
            {t("reports.notes.autoGenerate")}
          </div>
        </div>
        <div className="selection-section date-input-wrapper">
          <div className="start-end-date-section">
            <div className="start-date-section">
              <label
                className="selection-label"
                htmlFor="start-date-input"
                onClick={() =>
                  document.getElementById("start-date-input")?.focus()
                }
              >
                <Calendar size={16} /> {t("reports.filters.startDate")}
              </label>
              <input
                id="start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="invoice-date-input"
              />
            </div>
            <div className="end-date-section">
              <label
                className="selection-label"
                htmlFor="end-date-input"
                onClick={() =>
                  document.getElementById("end-date-input")?.focus()
                }
              >
                <Calendar size={16} /> {t("reports.filters.endDate")}
              </label>
              <input
                id="end-date-input"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="invoice-date-input"
              />
            </div>
          </div>
          <div style={{ marginTop: 4, color: "#888", fontSize: 13 }}>
            <strong>Note:</strong> {t("reports.notes.dateFilter")}{" "}
            <b>{t("reports.notes.invoiceDate")}</b>.
          </div>
        </div>
      </div>
      <div className="selection-row">
        <div className="selection-section">
          <label className="selection-label">
            {t("reports.filters.jobseekers")}
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
              placeholder={t("reports.placeholders.selectJobseekers")}
              multiSelect={true}
              showSelectAll={true}
              icon={<User size={16} />}
              emptyMessage={t("reports.emptyMessages.noJobseekers")}
              maxVisibleTagsOverride={3}
            />
          )}
        </div>
        <div className="selection-section salespers-section">
          <label className="selection-label">
            {t("reports.filters.salesPerson")}
          </label>
          <CustomDropdown
            options={salesPersonDropdownOptions}
            selectedOptions={
              selectedSalesPersons.length > 0
                ? selectedSalesPersons
                    .map(
                      (sp) =>
                        salesPersonDropdownOptions.find(
                          (o) => o.id === sp
                        ) as DropdownOption
                    )
                    .filter(Boolean)
                : []
            }
            onSelect={(opts) => {
              if (Array.isArray(opts))
                setSelectedSalesPersons(opts.map((o) => o.value as string));
              else if (opts && typeof opts === "object")
                setSelectedSalesPersons([opts.value as string]);
              else setSelectedSalesPersons([]);
            }}
            placeholder={t("reports.placeholders.selectSalesPersons")}
            multiSelect={true}
            showSelectAll={true}
            icon={<Users size={16} />}
            emptyMessage={t("reports.emptyMessages.noSalesPersons")}
            maxVisibleTagsOverride={3}
          />
        </div>
      </div>
    </div>
  );
}
